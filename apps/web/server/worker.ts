// Cloudflare Worker entry (root wrangler.jsonc). Static files come from the
// ASSETS binding with single-page fallback; wrangler runs this script first
// only for /api/*, where the Cloud OCR proxy lives.
//
// PADDLEOCR_ACCESS_TOKEN is a Worker secret, set outside the repository with
// `wrangler secret put PADDLEOCR_ACCESS_TOKEN`. Without it the proxy answers
// `not-configured`.
import {
  DEFAULT_CLOUD_OCR_JOB_URL,
  DEFAULT_CLOUD_OCR_MODEL,
  cloudOcrErrorResponse,
  createCloudOcrHandler,
} from './cloudOcrProxy.ts'

// Minimal local shapes instead of @cloudflare/workers-types.
interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>
}

interface WorkerEnv {
  ASSETS: AssetsBinding
  PADDLEOCR_ACCESS_TOKEN?: string
  PADDLEOCR_JOB_URL?: string
  PADDLEOCR_MODEL?: string
}

interface WorkerEntry {
  fetch: (request: Request, env: WorkerEnv) => Promise<Response>
}

const isApiPath = (pathname: string): boolean => pathname === '/api' || pathname.startsWith('/api/')

const worker: WorkerEntry = {
  async fetch(request, env) {
    if (!isApiPath(new URL(request.url).pathname)) {
      return env.ASSETS.fetch(request)
    }

    const handler = createCloudOcrHandler({
      accessToken: env.PADDLEOCR_ACCESS_TOKEN,
      jobUrl: env.PADDLEOCR_JOB_URL || DEFAULT_CLOUD_OCR_JOB_URL,
      model: env.PADDLEOCR_MODEL || DEFAULT_CLOUD_OCR_MODEL,
    })
    return (await handler(request)) ?? cloudOcrErrorResponse('not-found', 'Unknown API route.')
  },
}

export default worker
