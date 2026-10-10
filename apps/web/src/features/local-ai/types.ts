/**
 * `cloud-enhanced` marks pantries and cards whose page text came from Cloud
 * OCR. Cards are still generated on this device in both modes.
 */
export type GenerationMode = 'local-private' | 'cloud-enhanced'

export type GenerationMethod = 'webllm' | 'manual'

/** Where a page's text came from: the PDF's own text layer or OCR of its rendered image. */
export type TextSource = 'text-layer' | 'local-ocr' | 'cloud-ocr'

export interface SourcePage {
  id: string
  pageNumber: number
  text: string
  /** Missing on pages saved before OCR existed; those came from the text layer. */
  textSource?: TextSource
}

export interface SourceChunk {
  id: string
  pageNumber: number
  text: string
}

export interface GeneratedCard {
  id: string
  question: string
  options: string[]
  correctIndex: number
  /**
   * Optional short context shown behind a disclosure, never as part of the
   * answer. Learning content stays separate from verification metadata.
   */
  explanation?: string
  sourcePage: number
  sourceQuote: string
  sourceChunkId: string
  generationMode: GenerationMode
  createdAt: string
  generationMethod?: GenerationMethod
}

export interface CardValidation {
  valid: boolean
  errors: string[]
}

// Reason codes only. Diagnostics must never carry learner content.
export type CardRejectionReason =
  | 'invalid-json'
  | 'schema'
  | 'unknown-chunk'
  | 'quote-not-found'
  | 'quote-too-short'
  | 'options-invalid'
  | 'correct-index-invalid'
  | 'validation-failed'
  | 'question-length'
  | 'answer-length'
  | 'semantic-mismatch'
  | 'duplicate'

export interface ModelCardAnalysis {
  cards: GeneratedCard[]
  candidateCount: number
  rejections: CardRejectionReason[]
}

export interface GenerationDiagnostics {
  responses: number
  candidates: number
  reasons: Partial<Record<CardRejectionReason, number>>
}
