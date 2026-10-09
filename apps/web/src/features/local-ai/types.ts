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
