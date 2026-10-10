export type LocalOcrSupport = { supported: true } | { supported: false; reason: string }

export type LocalOcrStatus = {
  state: 'idle' | 'downloading' | 'initializing' | 'ready' | 'error'
  // A 0–1 fraction, set only when it is known. PaddleOCR.js reports no
  // download progress from its worker, so it stays unset until `ready`.
  progress?: number
  message?: string
}

export type LocalOcrResult = {
  // Recognised lines in reading order, joined with line breaks.
  text: string
  lines: ReadonlyArray<{ text: string; score?: number }>
  textSource: 'local-ocr'
  engine: { name: 'paddleocr-js'; version: string; ocrVersion: 'PP-OCRv5' }
}

export interface WarmUpLocalOcrOptions {
  onStatus?: (status: LocalOcrStatus) => void
  signal?: AbortSignal
}

export interface RecognizeImageOptions {
  signal?: AbortSignal
}
