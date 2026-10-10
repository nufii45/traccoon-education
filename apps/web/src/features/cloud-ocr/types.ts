/**
 * A learner's explicit permission to send rendered images of these pages to
 * Cloud OCR (PaddleOCR-VL through Traccoon's proxy). Created only by the
 * consent dialog; never inferred.
 */
export type CloudOcrConsent = {
  readonly kind: 'cloud-ocr'
  /** ISO timestamp of the learner's choice. */
  readonly grantedAt: string
  /** 1-based PDF page numbers the learner approved. */
  readonly pageNumbers: readonly number[]
}

export type CloudOcrProgress = {
  state: 'uploading' | 'pending' | 'running'
  totalPages?: number
  extractedPages?: number
}

export type CloudOcrPageResult = {
  pageNumber: number
  /** The Markdown PaddleOCR-VL returned for the page. */
  markdown: string
  /** Readable text for chunking and quote verification. */
  text: string
  textSource: 'cloud-ocr'
  model: string
}
