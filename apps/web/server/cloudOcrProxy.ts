// Same-origin Cloud OCR proxy for PaddleOCR-VL.
//
// The browser never holds the PaddleOCR token. It uploads one rendered page
// image to /api/cloud-ocr/jobs; this handler adds the token, the model, and the
// fixed options, forwards the image, then relays the job state and the page
// Markdown. It uses only the Fetch API, so the Vite dev and preview middleware
// (cloudOcrVitePlugin.ts) and the Cloudflare Worker (worker.ts) share it.
//
// Nothing here logs. Error responses carry generic messages only: never the
// token, the upload, or OCR text.

export const CLOUD_OCR_API_PATH = '/api/cloud-ocr'
export const DEFAULT_CLOUD_OCR_JOB_URL = 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs'
export const DEFAULT_CLOUD_OCR_MODEL = 'PaddleOCR-VL-1.6'

/** Largest page image the proxy forwards. */
export const MAX_CLOUD_OCR_UPLOAD_BYTES = 10 * 1024 * 1024
/** The upload limit plus room for the multipart boundary and part headers. */
export const MAX_CLOUD_OCR_REQUEST_BYTES = MAX_CLOUD_OCR_UPLOAD_BYTES + 64 * 1024

const UPSTREAM_TIMEOUT_MS = 30_000
const MAX_UPSTREAM_JSON_BYTES = 1024 * 1024
const MAX_RESULT_BYTES = 5 * 1024 * 1024
const MAX_ERROR_MESSAGE_CHARS = 300
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const JOB_PATH_PATTERN = /^\/api\/cloud-ocr\/jobs\/([^/]*)$/

// The same options as the reference client: no orientation, unwarping, or
// chart passes.
const OPTIONAL_PAYLOAD = JSON.stringify({
  useDocOrientationClassify: false,
  useDocUnwarping: false,
  useChartRecognition: false,
})

// Fixed upstream file names, so the learner's own file names never leave the device.
const UPLOAD_FILE_NAMES = { 'image/png': 'page.png', 'image/jpeg': 'page.jpg' } as const
type ImageMediaType = keyof typeof UPLOAD_FILE_NAMES

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

export type CloudOcrProxyErrorCode =
  | 'not-configured'
  | 'forbidden-origin'
  | 'method-not-allowed'
  | 'invalid-request'
  | 'unsupported-media-type'
  | 'payload-too-large'
  | 'upstream-auth'
  | 'upstream-error'
  | 'upstream-timeout'
  // Unknown routes under /api; the web client never requests one.
  | 'not-found'

export type CloudOcrJobState = 'pending' | 'running' | 'done' | 'failed'

export interface CloudOcrJobProgress {
  totalPages: number
  extractedPages: number
}

export interface CloudOcrJobPage {
  pageIndex: number
  markdown: string
}

/** Body of `GET /api/cloud-ocr/jobs/{jobId}`. */
export interface CloudOcrJobBody {
  jobId: string
  state: CloudOcrJobState
  progress?: CloudOcrJobProgress
  pages?: CloudOcrJobPage[]
  errorMessage?: string
}

export interface CloudOcrProxyConfig {
  /** Server-side secret. Never sent to the browser or written to a response. */
  accessToken?: string
  jobUrl: string
  model: string
  /** Injectable for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

/** Resolves null for paths outside /api/cloud-ocr so callers can fall through. */
export type CloudOcrHandler = (request: Request) => Promise<Response | null>

const ERROR_STATUS: Record<CloudOcrProxyErrorCode, number> = {
  'not-configured': 503,
  'forbidden-origin': 403,
  'method-not-allowed': 405,
  'invalid-request': 400,
  'unsupported-media-type': 415,
  'payload-too-large': 413,
  'upstream-auth': 502,
  'upstream-error': 502,
  'upstream-timeout': 504,
  'not-found': 404,
}

// Thrown inside the handler and turned into a JSON error response at the top.
class ProxyFailure extends Error {
  readonly code: CloudOcrProxyErrorCode
  readonly allow: string | undefined

  constructor(code: CloudOcrProxyErrorCode, message: string, allow?: string) {
    super(message)
    this.name = 'ProxyFailure'
    this.code = code
    this.allow = allow
  }
}

const tooLarge = (): ProxyFailure =>
  new ProxyFailure('payload-too-large', 'The page image is larger than the 10 MiB Cloud OCR limit.')

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })

/** A JSON error in the proxy's `{ error: { code, message } }` shape. */
export const cloudOcrErrorResponse = (
  code: CloudOcrProxyErrorCode,
  message: string,
  headers?: Record<string, string>,
): Response => jsonResponse(ERROR_STATUS[code], { error: { code, message } }, headers)

export const isCloudOcrPath = (pathname: string): boolean =>
  pathname === CLOUD_OCR_API_PATH || pathname.startsWith(`${CLOUD_OCR_API_PATH}/`)

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

// A present Origin must be this server's own origin. Dev servers are opened as
// localhost or 127.0.0.1 on any port, so a loopback page may also call a
// loopback server; that exception never applies to a public host.
const isAllowedOrigin = (origin: string, requestUrl: URL): boolean => {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  if (parsed.origin === requestUrl.origin) {
    return true
  }

  return LOOPBACK_HOSTNAMES.has(parsed.hostname) && LOOPBACK_HOSTNAMES.has(requestUrl.hostname)
}

const checkOrigin = (request: Request, requestUrl: URL): void => {
  const origin = request.headers.get('Origin')
  // Browsers send Origin with every POST, so one without it is not from our page.
  const allowed =
    origin === null ? request.method === 'GET' || request.method === 'HEAD' : isAllowedOrigin(origin, requestUrl)
  if (!allowed) {
    throw new ProxyFailure('forbidden-origin', 'Cloud OCR only accepts requests from this site.')
  }
}

const requireMethod = (request: Request, method: 'GET' | 'POST'): void => {
  if (request.method !== method) {
    throw new ProxyFailure('method-not-allowed', `Use ${method} for this Cloud OCR route.`, method)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

const isJobState = (value: unknown): value is CloudOcrJobState =>
  value === 'pending' || value === 'running' || value === 'done' || value === 'failed'

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isImageMediaType = (value: string): value is ImageMediaType => value === 'image/png' || value === 'image/jpeg'

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)

const sniffImageType = (bytes: Uint8Array): ImageMediaType | null => {
  if (startsWithBytes(bytes, PNG_SIGNATURE)) {
    return 'image/png'
  }
  if (startsWithBytes(bytes, JPEG_SIGNATURE)) {
    return 'image/jpeg'
  }
  return null
}

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

// AbortSignal.timeout rejects with a TimeoutError; some runtimes report AbortError.
const isTimeoutError = (error: unknown): boolean => {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined
  return name === 'TimeoutError' || name === 'AbortError'
}

const truncate = (value: string, maxChars: number): string =>
  value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value

// Reads a body stream into memory, failing as soon as it passes maxBytes.
const readLimited = async (
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  onTooLarge: () => ProxyFailure,
): Promise<Uint8Array> => {
  if (!body) {
    return new Uint8Array(0)
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw onTooLarge()
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

interface PageUpload {
  data: ArrayBuffer
  mediaType: ImageMediaType
}

const readPageUpload = async (request: Request): Promise<PageUpload> => {
  const contentType = request.headers.get('Content-Type') ?? ''
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    throw new ProxyFailure('unsupported-media-type', 'Send the page image as multipart/form-data.')
  }
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_CLOUD_OCR_REQUEST_BYTES) {
    throw tooLarge()
  }

  const body = await readLimited(request.body, MAX_CLOUD_OCR_REQUEST_BYTES, tooLarge)
  let form: FormData
  try {
    form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData()
  } catch {
    throw new ProxyFailure('invalid-request', 'The upload could not be read.')
  }

  const files = form.getAll('file')
  const file = files[0]
  if (files.length !== 1 || file === undefined || typeof file === 'string') {
    throw new ProxyFailure('invalid-request', 'Send exactly one page image in the file field.')
  }
  if (file.size > MAX_CLOUD_OCR_UPLOAD_BYTES) {
    throw tooLarge()
  }
  if (file.size === 0) {
    throw new ProxyFailure('invalid-request', 'The page image is empty.')
  }

  const mediaType = file.type
  if (!isImageMediaType(mediaType)) {
    throw new ProxyFailure('unsupported-media-type', 'Cloud OCR accepts PNG or JPEG page images only.')
  }
  const data = await file.arrayBuffer()
  if (sniffImageType(new Uint8Array(data)) !== mediaType) {
    throw new ProxyFailure('unsupported-media-type', 'The page image is not a valid PNG or JPEG file.')
  }
  return { data, mediaType }
}

interface UpstreamReply {
  status: number
  text: string
}

const requireUpstreamOk = (status: number): void => {
  if (status === 401 || status === 403) {
    throw new ProxyFailure('upstream-auth', 'Cloud OCR rejected the server credentials.')
  }
  if (status === 413) {
    throw new ProxyFailure('payload-too-large', 'The page image is too large for Cloud OCR.')
  }
  if (status < 200 || status >= 300) {
    throw new ProxyFailure('upstream-error', `Cloud OCR request failed with HTTP ${status}.`)
  }
}

const parseUpstreamJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProxyFailure('upstream-error', 'Cloud OCR returned an unreadable response.')
  }
}

const readProgress = (value: unknown): CloudOcrJobProgress | undefined => {
  const totalPages = readField(value, 'totalPages')
  const extractedPages = readField(value, 'extractedPages')
  return isCount(totalPages) && isCount(extractedPages) ? { totalPages, extractedPages } : undefined
}

// The result is JSONL: one JSON object per non-empty line, each holding
// `result.layoutParsingResults[].markdown.text`. Images are never downloaded.
const parseResultPages = (text: string): CloudOcrJobPage[] => {
  const pages: CloudOcrJobPage[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed) as unknown
    } catch {
      throw new ProxyFailure('upstream-error', 'Cloud OCR returned an unreadable result.')
    }

    const results = readField(readField(parsed, 'result'), 'layoutParsingResults')
    if (!Array.isArray(results)) {
      throw new ProxyFailure('upstream-error', 'Cloud OCR returned a result in an unexpected shape.')
    }
    for (const result of results) {
      const markdown = readField(readField(result, 'markdown'), 'text')
      if (typeof markdown !== 'string') {
        throw new ProxyFailure('upstream-error', 'Cloud OCR returned a result in an unexpected shape.')
      }
      pages.push({ pageIndex: pages.length, markdown })
    }
  }
  return pages
}

export const createCloudOcrHandler = (config: CloudOcrProxyConfig): CloudOcrHandler => {
  const accessToken = config.accessToken?.trim() ?? ''
  const configured = accessToken.length > 0
  const jobUrl = config.jobUrl.trim().replace(/\/+$/, '')
  const model = config.model.trim()
  // Called as a plain function: the Workers runtime rejects fetch with a foreign `this`.
  const fetchUpstream: typeof fetch = config.fetchImpl ?? ((input, init) => fetch(input, init))

  const requireConfigured = (): void => {
    if (!configured) {
      throw new ProxyFailure('not-configured', 'Cloud OCR is not configured on this server.')
    }
  }

  const authHeaders = (): Record<string, string> => ({ Authorization: `bearer ${accessToken}` })

  // One upstream call, body included, under a single timeout. Error bodies are
  // never read or relayed.
  const callUpstream = async (target: string, init: RequestInit, maxBytes: number): Promise<UpstreamReply> => {
    try {
      const response = await fetchUpstream(target, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined)
        return { status: response.status, text: '' }
      }
      const bytes = await readLimited(
        response.body,
        maxBytes,
        () => new ProxyFailure('upstream-error', 'Cloud OCR returned more data than expected.'),
      )
      return { status: response.status, text: new TextDecoder().decode(bytes) }
    } catch (error) {
      if (error instanceof ProxyFailure) {
        throw error
      }
      if (isTimeoutError(error)) {
        throw new ProxyFailure('upstream-timeout', 'Cloud OCR did not respond in time.')
      }
      throw new ProxyFailure('upstream-error', 'Cloud OCR could not be reached.')
    }
  }

  const submitJob = async (upload: PageUpload): Promise<string> => {
    const form = new FormData()
    form.append('model', model)
    form.append('optionalPayload', OPTIONAL_PAYLOAD)
    form.append('file', new Blob([upload.data], { type: upload.mediaType }), UPLOAD_FILE_NAMES[upload.mediaType])

    const reply = await callUpstream(jobUrl, { method: 'POST', headers: authHeaders(), body: form }, MAX_UPSTREAM_JSON_BYTES)
    requireUpstreamOk(reply.status)
    const jobId = readField(readField(parseUpstreamJson(reply.text), 'data'), 'jobId')
    if (typeof jobId !== 'string' || !JOB_ID_PATTERN.test(jobId)) {
      throw new ProxyFailure('upstream-error', 'Cloud OCR did not return a usable job id.')
    }
    return jobId
  }

  const fetchResultPages = async (jsonUrl: unknown): Promise<CloudOcrJobPage[]> => {
    if (typeof jsonUrl !== 'string' || !isHttpsUrl(jsonUrl)) {
      throw new ProxyFailure('upstream-error', 'Cloud OCR did not return a usable result link.')
    }
    // Like the reference client, the result link is fetched without the token.
    const reply = await callUpstream(jsonUrl, { method: 'GET' }, MAX_RESULT_BYTES)
    if (reply.status < 200 || reply.status >= 300) {
      throw new ProxyFailure('upstream-error', `Cloud OCR result download failed with HTTP ${reply.status}.`)
    }
    return parseResultPages(reply.text)
  }

  const getJob = async (jobId: string): Promise<CloudOcrJobBody> => {
    // jobId already matched JOB_ID_PATTERN, so it is safe as a path segment.
    const reply = await callUpstream(`${jobUrl}/${jobId}`, { method: 'GET', headers: authHeaders() }, MAX_UPSTREAM_JSON_BYTES)
    requireUpstreamOk(reply.status)
    const data = readField(parseUpstreamJson(reply.text), 'data')
    const state = readField(data, 'state')
    if (!isJobState(state)) {
      throw new ProxyFailure('upstream-error', 'Cloud OCR returned an unknown job state.')
    }

    const job: CloudOcrJobBody = { jobId, state }
    const progress = readProgress(readField(data, 'extractProgress'))
    if (progress) {
      job.progress = progress
    }
    if (state === 'failed') {
      const reason = readField(data, 'errorMsg')
      const message = typeof reason === 'string' ? reason.replace(/\s+/g, ' ').trim() : ''
      job.errorMessage = truncate(message || 'Cloud OCR could not process this page.', MAX_ERROR_MESSAGE_CHARS)
    } else if (state === 'done') {
      job.pages = await fetchResultPages(readField(readField(data, 'resultUrl'), 'jsonUrl'))
    }
    return job
  }

  const route = async (request: Request, pathname: string): Promise<Response> => {
    if (pathname === `${CLOUD_OCR_API_PATH}/status`) {
      requireMethod(request, 'GET')
      return jsonResponse(200, { configured, model })
    }

    if (pathname === `${CLOUD_OCR_API_PATH}/jobs`) {
      requireMethod(request, 'POST')
      requireConfigured()
      const jobId = await submitJob(await readPageUpload(request))
      // `model` is an addition to the documented `{ jobId }` body, so the
      // client can record which model read the page.
      return jsonResponse(202, { jobId, model })
    }

    const jobMatch = JOB_PATH_PATTERN.exec(pathname)
    if (jobMatch) {
      requireMethod(request, 'GET')
      requireConfigured()
      const jobId = jobMatch[1] ?? ''
      if (!JOB_ID_PATTERN.test(jobId)) {
        throw new ProxyFailure('invalid-request', 'The job id is not valid.')
      }
      return jsonResponse(200, await getJob(jobId))
    }

    throw new ProxyFailure('not-found', 'Unknown Cloud OCR route.')
  }

  return async (request) => {
    const url = new URL(request.url)
    if (!isCloudOcrPath(url.pathname)) {
      return null
    }

    try {
      checkOrigin(request, url)
      return await route(request, url.pathname)
    } catch (error) {
      if (error instanceof ProxyFailure) {
        return cloudOcrErrorResponse(error.code, error.message, error.allow ? { Allow: error.allow } : undefined)
      }
      return cloudOcrErrorResponse('upstream-error', 'Cloud OCR request failed.')
    }
  }
}
