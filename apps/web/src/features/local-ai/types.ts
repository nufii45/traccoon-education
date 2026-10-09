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
