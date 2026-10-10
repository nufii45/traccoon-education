// Turns whatever PaddleOCR.js, its worker, or ONNX Runtime throws into one
// short sentence a learner can act on. Worker errors arrive as plain Error
// objects rebuilt from a name and message. Messages built here carry engine
// diagnostics only (runtime errors, public asset URLs), never page images or
// recognised text.

export type LocalOcrErrorCode =
  | 'unsupported'
  | 'model-load-failed'
  | 'offline-model-missing'
  | 'recognition-failed'
  | 'cancelled'

export class LocalOcrError extends Error {
  readonly code: LocalOcrErrorCode

  constructor(code: LocalOcrErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'LocalOcrError'
    this.code = code
  }
}

const MAX_DETAIL_CHARS = 160

const CANCELLED_MESSAGE = 'Local OCR was cancelled.'
const OFFLINE_MESSAGE =
  'You are offline and the local OCR model is not saved on this device yet. Connect once to download it, then try again.'
const LOAD_FAILED_MESSAGE =
  'The local OCR model could not be downloaded or started. Check your connection and free storage, then try again.'
const STALE_FILES_MESSAGE = 'The local OCR files could not be loaded. Reload the page, then try again.'
const UNSUPPORTED_MESSAGE = 'This browser cannot run local OCR. Write cards by hand instead.'
const RECOGNITION_FAILED_MESSAGE = 'Local OCR could not read this page image. Try again, or write cards by hand.'
export const RECOGNITION_TIMEOUT_MESSAGE =
  'Local OCR took too long to read this page. Try again, or write cards by hand.'

// Capabilities PaddleOCR.js or ONNX Runtime check for at start-up.
const UNSUPPORTED_PATTERN =
  /SIMD is not supported|requires OffscreenCanvas|requires ImageBitmap|requires Web Worker|WebAssembly is not (?:supported|defined)|Worker is not defined/i

// A stale tab asking for hashed files that a newer deploy replaced.
const STALE_FILES_PATTERN = /dynamically imported module|importing a module script failed|ChunkLoadError/i

const rawFailureText = (error: unknown): string => {
  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null) {
    const { name, message } = error as { name?: unknown; message?: unknown }
    const label = typeof name === 'string' && name !== 'Error' ? name : ''
    const text = typeof message === 'string' ? message : ''
    return label && text ? `${label}: ${text}` : label || text
  }

  return ''
}

const tidyDetail = (raw: string): string => {
  const flattened = raw.replace(/\s+/g, ' ').trim()
  return flattened.length > MAX_DETAIL_CHARS ? `${flattened.slice(0, MAX_DETAIL_CHARS - 1).trimEnd()}…` : flattened
}

const withDetail = (summary: string, raw: string): string => {
  const detail = tidyDetail(raw)
  return detail ? `${summary} Details: ${detail}` : summary
}

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false

export const cancelledError = (): LocalOcrError => new LocalOcrError('cancelled', CANCELLED_MESSAGE)

export const unsupportedError = (reason: string): LocalOcrError =>
  new LocalOcrError('unsupported', `This browser cannot run local OCR: ${reason} Write cards by hand instead.`)

export const classifyStartFailure = (error: unknown): LocalOcrError => {
  if (error instanceof LocalOcrError) {
    return error
  }

  const raw = rawFailureText(error)
  if (UNSUPPORTED_PATTERN.test(raw)) {
    return new LocalOcrError('unsupported', withDetail(UNSUPPORTED_MESSAGE, raw), { cause: error })
  }
  // Offline, every missing runtime or model file fails the same way, so the
  // cause is the file that was never saved rather than the fetch error.
  if (isOffline()) {
    return new LocalOcrError('offline-model-missing', OFFLINE_MESSAGE, { cause: error })
  }
  if (STALE_FILES_PATTERN.test(raw)) {
    return new LocalOcrError('model-load-failed', STALE_FILES_MESSAGE, { cause: error })
  }
  return new LocalOcrError('model-load-failed', withDetail(LOAD_FAILED_MESSAGE, raw), { cause: error })
}

export const classifyRecognitionFailure = (error: unknown): LocalOcrError =>
  error instanceof LocalOcrError
    ? error
    : new LocalOcrError('recognition-failed', withDetail(RECOGNITION_FAILED_MESSAGE, rawFailureText(error)), { cause: error })
