// Serves the Cloud OCR proxy from `vite` and `vite preview`, so local runs use
// the same same-origin /api/cloud-ocr routes as the deployed Worker.
//
// PADDLEOCR_* values come from apps/web/.env (or the process environment)
// through loadEnv. Vite exposes only VITE_* values to browser code, so the
// token stays in this Node process. Builds never load it (`apply: 'serve'`).
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv } from 'vite'
import type { Connect, Plugin } from 'vite'
import {
  DEFAULT_CLOUD_OCR_JOB_URL,
  DEFAULT_CLOUD_OCR_MODEL,
  MAX_CLOUD_OCR_REQUEST_BYTES,
  cloudOcrErrorResponse,
  createCloudOcrHandler,
  isCloudOcrPath,
} from './cloudOcrProxy.ts'
import type { CloudOcrHandler } from './cloudOcrProxy.ts'

// Connection-level headers that do not belong on the Fetch Request.
const SKIPPED_HEADERS = new Set(['connection', 'content-length', 'host', 'keep-alive', 'transfer-encoding', 'upgrade'])

const toHeaders = (incoming: IncomingHttpHeaders): Headers => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming)) {
    // HTTP/2 pseudo-headers such as :authority are not valid header names.
    if (value === undefined || name.startsWith(':') || SKIPPED_HEADERS.has(name)) {
      continue
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item)
    }
  }
  return headers
}

const toRequestUrl = (req: Connect.IncomingMessage): URL | null => {
  const authority = req.headers.host ?? req.headers[':authority']
  const host = typeof authority === 'string' && authority ? authority : 'localhost'
  const protocol = 'encrypted' in req.socket && req.socket.encrypted === true ? 'https' : 'http'
  try {
    return new URL(req.originalUrl ?? req.url ?? '/', `${protocol}://${host}`)
  } catch {
    return null
  }
}

// Buffers a request body up to maxBytes. Resolves null when the body is
// larger; the rest is drained so the client still receives the 413.
const readNodeBody = (req: IncomingMessage, maxBytes: number): Promise<Buffer | null> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let overLimit = false
    req.on('data', (chunk: Buffer) => {
      if (overLimit) {
        return
      }
      size += chunk.length
      if (size > maxBytes) {
        overLimit = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(overLimit ? null : Buffer.concat(chunks)))
    req.on('error', reject)
    // After 'end' this is a no-op; before it, the client went away mid-upload.
    req.on('close', () => reject(new Error('The request closed before its body was read.')))
  })

const sendResponse = async (res: ServerResponse, response: Response): Promise<void> => {
  const body = Buffer.from(await response.arrayBuffer())
  res.statusCode = response.status
  response.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })
  res.end(body)
}

const payloadTooLarge = (): Response =>
  cloudOcrErrorResponse('payload-too-large', 'The page image is larger than the 10 MiB Cloud OCR limit.')

const serve = async (
  handler: CloudOcrHandler,
  req: Connect.IncomingMessage,
  res: ServerResponse,
  url: URL,
  next: Connect.NextFunction,
): Promise<void> => {
  const method = req.method ?? 'GET'
  let body: Buffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    if (Number(req.headers['content-length'] ?? 0) > MAX_CLOUD_OCR_REQUEST_BYTES) {
      await sendResponse(res, payloadTooLarge())
      return
    }

    let read: Buffer | null
    try {
      read = await readNodeBody(req, MAX_CLOUD_OCR_REQUEST_BYTES)
    } catch {
      // The connection broke mid-upload, so nobody is left to answer.
      res.destroy()
      return
    }
    if (!read) {
      await sendResponse(res, payloadTooLarge())
      return
    }
    body = read
  }

  const response = await handler(new Request(url, { method, headers: toHeaders(req.headers), body }))
  if (!response) {
    next()
    return
  }
  await sendResponse(res, response)
}

const createMiddleware =
  (getHandler: () => CloudOcrHandler): Connect.NextHandleFunction =>
  (req, res, next) => {
    const url = toRequestUrl(req)
    // Check the path before touching the body, so other routes keep theirs.
    if (!url || !isCloudOcrPath(url.pathname)) {
      next()
      return
    }
    void serve(getHandler(), req, res, url, next).catch((error: unknown) => {
      next(error)
    })
  }

export function cloudOcrProxyPlugin(): Plugin {
  // Unconfigured until configResolved reads the environment, so routes answer
  // `not-configured` rather than falling through to the app.
  let handler: CloudOcrHandler = createCloudOcrHandler({
    jobUrl: DEFAULT_CLOUD_OCR_JOB_URL,
    model: DEFAULT_CLOUD_OCR_MODEL,
  })

  return {
    name: 'traccoon-cloud-ocr-proxy',
    // `vite` and `vite preview` both resolve with the 'serve' command.
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir || config.root, 'PADDLEOCR_')
      handler = createCloudOcrHandler({
        accessToken: env.PADDLEOCR_ACCESS_TOKEN,
        jobUrl: env.PADDLEOCR_JOB_URL || DEFAULT_CLOUD_OCR_JOB_URL,
        model: env.PADDLEOCR_MODEL || DEFAULT_CLOUD_OCR_MODEL,
      })
    },
    configureServer(server) {
      server.middlewares.use(createMiddleware(() => handler))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(() => handler))
    },
  }
}
