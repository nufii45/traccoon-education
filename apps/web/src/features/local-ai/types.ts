export type GenerationMode = 'local-private'

export type GenerationMethod = 'webllm' | 'manual'

export interface SourcePage {
  id: string
  pageNumber: number
  text: string
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
