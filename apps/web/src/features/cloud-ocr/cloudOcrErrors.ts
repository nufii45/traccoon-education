// Every Cloud OCR failure surfaces as a CloudOcrError with a code the UI can
// branch on and one learner-readable sentence. Messages never contain page
// images, OCR text, or credentials.

export type CloudOcrErrorCode =
  // Codes the proxy returns (apps/web/server/cloudOcrProxy.ts).
  | 'not-configured'
  | 'forbidden-origin'
  | 'method-not-allowed'
  | 'invalid-request'
  | 'unsupported-media-type'
  | 'payload-too-large'
  | 'upstream-auth'
  | 'upstream-error'
  | 'upstream-timeout'
  // Codes raised in the browser.
  | 'consent-required'
  | 'cancelled'
  | 'network'
  | 'timeout'
  | 'malformed-response'

const MAX_DETAIL_CHARS = 300

const CLOUD_OCR_ERROR_MESSAGES: Record<CloudOcrErrorCode, string> = {
  'not-configured': 'Cloud OCR is not set up on this server. Use local OCR or author cards manually.',
  'forbidden-origin': 'Cloud OCR refused a request from this page. Reload Traccoon, then try again.',
  'method-not-allowed': 'Cloud OCR refused the request. Reload Traccoon, then try again.',
  'invalid-request': 'Cloud OCR could not read the uploaded page image. Try again.',
  'unsupported-media-type': 'Cloud OCR accepts PNG or JPEG page images only.',
  'payload-too-large': 'This page image is larger than the 10 MiB Cloud OCR limit.',
  'upstream-auth': 'The Cloud OCR service rejected the server credentials. Use local OCR or author cards manually.',
  'upstream-error': 'The Cloud OCR service could not read this page. Try again, or author cards manually.',
  'upstream-timeout': 'The Cloud OCR service did not respond in time. Try again.',
  'consent-required': 'Cloud OCR needs your permission for this page before anything is uploaded.',
  cancelled: 'Cloud OCR was cancelled.',
  network: 'Cloud OCR could not be reached. Check your connection, then try again.',
  timeout: 'Cloud OCR took too long for this page. Try again, or author cards manually.',
  'malformed-response': 'Cloud OCR sent a response Traccoon could not understand. Try again.',
}

const composeMessage = (code: CloudOcrErrorCode, detail: string | undefined): string => {
  const tidy = detail?.replace(/\s+/g, ' ').trim() ?? ''
  if (!tidy) {
    return CLOUD_OCR_ERROR_MESSAGES[code]
  }
  const clipped = tidy.length > MAX_DETAIL_CHARS ? `${tidy.slice(0, MAX_DETAIL_CHARS - 1).trimEnd()}…` : tidy
  return `${CLOUD_OCR_ERROR_MESSAGES[code]} Details: ${clipped}`
}

export class CloudOcrError extends Error {
  readonly code: CloudOcrErrorCode

  /** `detail` is service wording, such as why PaddleOCR failed a job. */
  constructor(code: CloudOcrErrorCode, detail?: string) {
    super(composeMessage(code, detail))
    this.name = 'CloudOcrError'
    this.code = code
  }
}
