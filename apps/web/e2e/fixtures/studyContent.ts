import { randomUUID } from 'node:crypto'

/**
 * Per-run canary study content. The run id is random, so these strings cannot
 * appear in app assets or third-party URLs by accident: if one shows up in an
 * outgoing request, study content left the page.
 */
export type StudyCanaries = {
  runId: string
  /** One sentence per PDF page, each well over MIN_NORMALIZED_QUOTE_CHARS (32). */
  pageSentences: string[]
  cardQuestion: string
  cardOptions: string[]
  /** Every distinctive token plus each full sentence, checked in all encodings. */
  tokens: string[]
}

export const createStudyCanaries = (): StudyCanaries => {
  const runId = randomUUID().slice(0, 8)
  const pageTokens = [`TRACCOON-CANARY-P1-${runId}`, `TRACCOON-CANARY-P2-${runId}`]
  const pageSentences = [
    `${pageTokens[0]} marks the mitochondrial matrix where the citric acid cycle runs.`,
    `${pageTokens[1]} notes that oxidative phosphorylation happens on the inner membrane.`,
  ]
  const cardToken = `TRACCOON-CARD-${runId}`
  const cardQuestion = `${cardToken} Where does the cycle run`
  const cardOptions = ['A', 'B', 'C', 'D'].map((letter) => `TRACCOON-OPT-${runId}-${letter}`)

  return {
    runId,
    pageSentences,
    cardQuestion,
    cardOptions,
    tokens: [...pageTokens, cardToken, ...cardOptions, ...pageSentences, cardQuestion],
  }
}

/** Raw, lower-case, URL-encoded, form-encoded, base64, and base64url forms. */
export const encodedVariants = (value: string): string[] => {
  const base64 = Buffer.from(value, 'utf8').toString('base64')
  return [
    ...new Set([
      value,
      value.toLowerCase(),
      encodeURIComponent(value),
      encodeURIComponent(value).replace(/%20/g, '+'),
      base64,
      base64.replace(/=+$/, ''),
      Buffer.from(value, 'utf8').toString('base64url'),
    ]),
  ]
}

/**
 * Shapes that only appear in prompts, source chunks, cards, and study attempts
 * (see localGenerator.ts, chunks.ts, manualCard.ts, and the attempt record).
 * Checked against request bodies and URL query/hash, not paths, so dev-server
 * module paths such as /src/features/local-ai/... do not false-positive.
 */
export const STRUCTURAL_MARKERS: readonly (string | RegExp)[] = [
  'SOURCE_CHUNK',
  'END_SOURCE_CHUNK',
  'Return only a JSON array',
  /page-\d+-chunk-\d+/,
  /manual-page-\d+/,
  'sourceQuote',
  'sourceChunkId',
  'generationMode',
  'local-private',
  'selectedIndex',
  'isCorrect',
  'correctIndex',
]

export const PDF_MAGIC = '%PDF-'
