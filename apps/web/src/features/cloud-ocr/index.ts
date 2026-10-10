// Public API for Cloud OCR (PaddleOCR-VL through Traccoon's same-origin proxy).
// UI code imports from this file only.
export { CloudOcrError } from './cloudOcrErrors'
export type { CloudOcrErrorCode } from './cloudOcrErrors'
export { getCloudOcrStatus, runCloudOcrForPage } from './cloudOcrClient'
export { cloudMarkdownToPlainText } from './cloudOcrMarkdown'
export type { CloudOcrConsent, CloudOcrPageResult, CloudOcrProgress } from './types'
