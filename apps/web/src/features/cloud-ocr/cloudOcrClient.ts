// Browser client for the same-origin Cloud OCR proxy (apps/web/server). It
// uploads one rendered page image per job, only after the learner consented
// to Cloud OCR for that page, and needs no token or VITE_* setting. Every
// request goes to /api/cloud-ocr, so Local Private flows must not call this
// module at all, including getCloudOcrStatus. Nothing here logs.
import { CloudOcrError } from './cloudOcrErrors'
import type { CloudOcrErrorCode } from './cloudOcrErrors'
import { cloudMarkdownToPlainText } from './cloudOcrMarkdown'
import type { CloudOcrConsent, CloudOcrPageResult, CloudOcrProgress } from './types'

const API_BASE = '/api/cloud-ocr'
const DEFAULT_POLL_INTERVAL_MS = 1_500
const DEFAULT_TIMEOUT_MS = 180_000
// Mirrors MAX_CLOUD_OCR_UPLOAD_BYTES in apps/web/server/cloudOcrProxy.ts.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

// Fixed names, so the learner's own file names never leave the device.
const UPLOAD_FILE_NAMES: Record<string, string> = { 'image/png': 'page.png', 'image/jpeg': 'page.jpg' }

const PROXY_ERROR_CODES: ReadonlySet<string> = new Set<CloudOcrErrorCode>([
  'not-configured',
  'forbidden-origin',
  'method-not-allowed',
  'invalid-request',
  'unsupported-media-type',
  'payload-too-large',
  'upstream-auth',
  'upstream-error',
  'upstream-timeout',
])

type StopCode = 'cancelled' | 'timeout'

interface RunControl {
  signal: AbortSignal
  /** Why the run stopped, once the caller cancelled it or it timed out. */
  stopCode: () => StopCode | undefined
  dispose: () => void
}

// One abort signal for a whole run that remembers whether the caller
// cancelled it or the deadline passed.
const createRunControl = (external: AbortSignal | undefined, timeoutMs?: number): RunControl => {
  const controller = new AbortController()
  let stopped: StopCode | undefined
  const stop = (code: StopCode) => {
    stopped ??= code
    controller.abort()
  }
  const onExternalAbort = () => stop('cancelled')

  if (external?.aborted) {
    stop('cancelled')
  } else {
    external?.addEventListener('abort', onExternalAbort, { once: true })
  }
  const timer = timeoutMs === undefined ? undefined : setTimeout(() => stop('timeout'), timeoutMs)

  return {
    signal: controller.signal,
    stopCode: () => stopped,
    dispose: () => {
      clearTimeout(timer)
      external?.removeEventListener('abort', onExternalAbort)
    },
  }
}

const wait = (ms: number, run: RunControl): Promise<void> =>
  new Promise((resolve, reject) => {
    const stoppedError = () => new CloudOcrError(run.stopCode() ?? 'cancelled')
    if (run.signal.aborted) {
      reject(stoppedError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(stoppedError())
    }
    const timer = setTimeout(() => {
      run.signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    run.signal.addEventListener('abort', onAbort, { once: true })
  })

const readField = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined

const toResponseError = (status: number, body: unknown): CloudOcrError => {
  const error = readField(body, 'error')
  const code = readField(error, 'code')
  if (typeof code === 'string' && PROXY_ERROR_CODES.has(code)) {
    const message = readField(error, 'message')
    // Only upstream failures gain detail, such as the HTTP status PaddleOCR returned.
    return new CloudOcrError(
      code as CloudOcrErrorCode,
      code === 'upstream-error' && typeof message === 'string' ? message : undefined,
    )
  }
  return new CloudOcrError(status >= 500 ? 'upstream-error' : 'malformed-response')
}

const requestJson = async (path: string, init: RequestInit, run: RunControl): Promise<unknown> => {
  let response: Response
  try {
    response = await fetch(path, { ...init, cache: 'no-store', credentials: 'same-origin', signal: run.signal })
  } catch {
    throw new CloudOcrError(run.stopCode() ?? 'network')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    const stopCode = run.stopCode()
    if (stopCode) {
      throw new CloudOcrError(stopCode)
    }
    body = undefined
  }

  if (!response.ok) {
    throw toResponseError(response.status, body)
  }
  if (body === undefined) {
    throw new CloudOcrError('malformed-response')
  }
  return body
}

const hasConsentForPage = (consent: CloudOcrConsent | undefined, pageNumber: number): boolean =>
  consent?.kind === 'cloud-ocr' &&
  typeof consent.grantedAt === 'string' &&
  consent.grantedAt.length > 0 &&
  Array.isArray(consent.pageNumbers) &&
  consent.pageNumbers.includes(pageNumber)

const readProgress = (value: unknown): Pick<CloudOcrProgress, 'totalPages' | 'extractedPages'> => {
  const totalPages = readField(value, 'totalPages')
  const extractedPages = readField(value, 'extractedPages')
  return typeof totalPages === 'number' && typeof extractedPages === 'number' ? { totalPages, extractedPages } : {}
}

const readPageMarkdown = (value: unknown): string => {
  if (!Array.isArray(value)) {
    throw new CloudOcrError('malformed-response')
  }
  const pages = value.map((page: unknown) => {
    const pageIndex = readField(page, 'pageIndex')
    const markdown = readField(page, 'markdown')
    if (typeof pageIndex !== 'number' || typeof markdown !== 'string') {
      throw new CloudOcrError('malformed-response')
    }
    return { pageIndex, markdown }
  })
  return pages
    .sort((left, right) => left.pageIndex - right.pageIndex)
    .map((page) => page.markdown)
    .join('\n\n')
}

/**
 * Reports whether this server can run Cloud OCR. Call it only after the
 * learner chooses Cloud OCR: it is a request to /api/cloud-ocr.
 */
export async function getCloudOcrStatus(signal?: AbortSignal): Promise<{ configured: boolean, model: string }> {
  const run = createRunControl(signal)
  try {
    const status = await requestJson(`${API_BASE}/status`, { method: 'GET' }, run)
    const configured = readField(status, 'configured')
    const model = readField(status, 'model')
    if (typeof configured !== 'boolean' || typeof model !== 'string') {
      throw new CloudOcrError('malformed-response')
    }
    return { configured, model }
  } finally {
    run.dispose()
  }
}

/**
 * Sends one rendered page image (PNG or JPEG) to Cloud OCR and waits for its
 * text. Throws `consent-required` before any request unless `consent` covers
 * `pageNumber`. The timeout covers the upload and all polling.
 */
export async function runCloudOcrForPage(input: {
  image: Blob
  pageNumber: number
  consent: CloudOcrConsent
  signal?: AbortSignal
  onProgress?: (progress: CloudOcrProgress) => void
  pollIntervalMs?: number
  timeoutMs?: number
}): Promise<CloudOcrPageResult> {
  const { image, pageNumber, consent, signal, onProgress } = input
  if (!hasConsentForPage(consent, pageNumber)) {
    throw new CloudOcrError('consent-required')
  }
  if (signal?.aborted) {
    throw new CloudOcrError('cancelled')
  }
  const fileName = UPLOAD_FILE_NAMES[image.type]
  if (!fileName) {
    throw new CloudOcrError('unsupported-media-type')
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    throw new CloudOcrError('payload-too-large')
  }

  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const run = createRunControl(signal, input.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    onProgress?.({ state: 'uploading' })
    const form = new FormData()
    form.append('file', image, fileName)
    const created = await requestJson(`${API_BASE}/jobs`, { method: 'POST', body: form }, run)
    const jobId = readField(created, 'jobId')
    const model = readField(created, 'model')
    if (typeof jobId !== 'string' || !JOB_ID_PATTERN.test(jobId) || typeof model !== 'string' || !model) {
      throw new CloudOcrError('malformed-response')
    }

    // The provider may finish before the first interval elapses. Check once
    // immediately, then wait between subsequent checks.
    for (let firstCheck = true;; firstCheck = false) {
      if (!firstCheck) {
        await wait(pollIntervalMs, run)
      }
      const job = await requestJson(`${API_BASE}/jobs/${jobId}`, { method: 'GET' }, run)
      const state = readField(job, 'state')
      if (state === 'pending' || state === 'running') {
        onProgress?.({ state, ...readProgress(readField(job, 'progress')) })
      } else if (state === 'done') {
        const markdown = readPageMarkdown(readField(job, 'pages'))
        return { pageNumber, markdown, text: cloudMarkdownToPlainText(markdown), textSource: 'cloud-ocr', model }
      } else if (state === 'failed') {
        const reason = readField(job, 'errorMessage')
        throw new CloudOcrError('upstream-error', typeof reason === 'string' ? reason : undefined)
      } else {
        throw new CloudOcrError('malformed-response')
      }
    }
  } finally {
    run.dispose()
  }
}
