import { z } from 'zod'
import { validateGeneratedCard } from './cardRules'
import { MAX_CARDS_PER_RUN } from './policy'
import { anchorQuote } from './quoteAnchor'
import type {
  CardRejectionReason,
  GeneratedCard,
  ModelCardAnalysis,
  SourceChunk,
  SourcePage,
} from './types'

// Each candidate is parsed on its own so one malformed card cannot discard the
// rest. Provenance (page, quote, chunk) is derived from the real chunks, so the
// model's sourcePage is ignored and unknown keys are stripped.
const modelCardSchema = z.object({
  question: z.string(),
  options: z.array(z.union([z.string(), z.number()])),
  correctIndex: z.union([z.number(), z.string()]).optional(),
  answer: z.string().optional(),
  correctAnswer: z.string().optional(),
  sourceChunkId: z.string().optional(),
  sourceQuote: z.string().optional(),
})

type ModelCard = z.infer<typeof modelCardSchema>

// JSON Schema for WebLLM `response_format: { type: 'json_object' }`.
export const LOCAL_CARD_RESPONSE_SCHEMA: string = JSON.stringify({
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_CARDS_PER_RUN,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
          sourceChunkId: { type: 'string' },
          sourceQuote: { type: 'string' },
        },
        required: ['question', 'options', 'correctIndex', 'sourceChunkId', 'sourceQuote'],
      },
    },
  },
  required: ['cards'],
})

export const buildLocalGenerationPrompt = (chunks: SourceChunk[], requestedCount: number): string => {
  const sources = chunks
    .map(
      (chunk) =>
        `SOURCE_CHUNK id=${chunk.id} page=${chunk.pageNumber}\n${chunk.text}\nEND_SOURCE_CHUNK`,
    )
    .join('\n\n')

  return `Create up to ${Math.min(requestedCount, MAX_CARDS_PER_RUN)} multiple-choice study cards. Use a different source chunk for each card when possible, one card per chunk.
Return only a JSON object in this exact shape:
{"cards":[{"question":"A question answered by the chunk?","options":["answer A","answer B","answer C","answer D"],"correctIndex":0,"sourceChunkId":"the id of the chunk you used","sourceQuote":"one complete sentence copied from that chunk"}]}
Rules:
- options must be four different short answers. Exactly one is correct.
- correctIndex is a number from 0 to 3 that points to the correct option.
- sourceChunkId is the id shown after SOURCE_CHUNK id=.
- Copy one complete sentence from the chunk into sourceQuote. Do not change its words.
- Use only facts from the source chunks.

${sources}`
}

const tryParse = (candidate: string): unknown => {
  try {
    return JSON.parse(candidate) as unknown
  } catch {
    return undefined
  }
}

const stripTrailingCommas = (candidate: string): string =>
  candidate.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}')

// Recover complete top-level `{...}` objects from a possibly truncated array by
// counting bracket depth while respecting strings and escaped quotes, so braces
// inside string values do not miscount. A truncated final object is skipped.
const salvageObjects = (candidate: string): unknown[] => {
  const objects: unknown[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < candidate.length; index += 1) {
    const char = candidate[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
    } else if (char === '}') {
      if (depth > 0) {
        depth -= 1
        if (depth === 0 && start >= 0) {
          const parsed = tryParse(candidate.slice(start, index + 1))
          if (parsed !== undefined) {
            objects.push(parsed)
          }
          start = -1
        }
      }
    }
  }

  return objects
}

const parseWithRepair = (candidate: string): unknown => {
  const strict = tryParse(candidate)
  return strict !== undefined ? strict : tryParse(stripTrailingCommas(candidate))
}

// Returns parsed model output on success or `undefined` on unrecoverable
// output. Never throws.
const extractJson = (content: string): unknown => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const base = (fenced ?? content).trim()
  if (base.length === 0) {
    return undefined
  }

  const whole = parseWithRepair(base)
  if (whole !== undefined) {
    return whole
  }

  // Slice from whichever JSON container opens first, so a bare card object is
  // not reduced to its options array.
  const arrayStart = base.indexOf('[')
  const objectStart = base.indexOf('{')
  const useObject = objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)
  const start = useObject ? objectStart : arrayStart
  const end = useObject ? base.lastIndexOf('}') : base.lastIndexOf(']')
  if (start >= 0 && end > start) {
    const sliced = parseWithRepair(base.slice(start, end + 1))
    if (sliced !== undefined) {
      return sliced
    }
  }

  // Salvage scans from the first '[' to the end of the output so a truncated
  // array (cut off by max_tokens), including one inside {"cards":[...], still
  // yields its complete objects.
  const salvaged = salvageObjects(arrayStart >= 0 ? base.slice(arrayStart) : base)
  if (salvaged.length > 0) {
    return salvaged
  }

  return undefined
}

const unwrapCandidates = (value: unknown): unknown[] | undefined => {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    for (const key of ['cards', 'questions', 'items']) {
      const nested = record[key]
      if (Array.isArray(nested)) {
        return nested
      }
    }
    if (typeof record.question === 'string') {
      return [value]
    }
  }

  return undefined
}

const LETTER_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 }

// Resolves the correct option without guessing: an integer, a numeric string,
// a single letter A-D, or answer text that exactly matches one option.
const resolveCorrectIndex = (card: ModelCard, options: string[]): number | undefined => {
  const { correctIndex } = card

  if (typeof correctIndex === 'number') {
    return Number.isInteger(correctIndex) ? correctIndex : undefined
  }

  if (typeof correctIndex === 'string') {
    if (/^\s*\d+\s*$/.test(correctIndex)) {
      return Number(correctIndex)
    }
    const letter = LETTER_INDEX[correctIndex.trim().toLocaleLowerCase()]
    if (letter !== undefined) {
      return letter
    }
  }

  const answerTexts = [typeof correctIndex === 'string' ? correctIndex : undefined, card.answer, card.correctAnswer]
  for (const answer of answerTexts) {
    if (answer === undefined) {
      continue
    }
    const target = answer.trim().toLocaleLowerCase()
    const matches = options.flatMap((option, index) => (option.toLocaleLowerCase() === target ? [index] : []))
    if (matches.length === 1) {
      return matches[0]
    }
  }

  return undefined
}

type CandidateOutcome = { card: GeneratedCard } | { reason: CardRejectionReason }

const analyseCandidate = (
  raw: unknown,
  position: number,
  chunks: SourceChunk[],
  sourcePages: SourcePage[],
  now: () => string,
): CandidateOutcome => {
  const parsed = modelCardSchema.safeParse(raw)
  if (!parsed.success) {
    return { reason: 'schema' }
  }

  const card = parsed.data
  const question = card.question.trim()
  if (question.length === 0) {
    return { reason: 'schema' }
  }

  const options = card.options.map((option) => String(option).trim())
  const distinct = new Set(options.map((option) => option.toLocaleLowerCase()))
  if (options.length !== 4 || options.some((option) => option.length === 0) || distinct.size !== 4) {
    return { reason: 'options-invalid' }
  }

  const correctIndex = resolveCorrectIndex(card, options)
  if (correctIndex === undefined || correctIndex < 0 || correctIndex > 3) {
    return { reason: 'correct-index-invalid' }
  }

  const anchored = anchorQuote(card.sourceQuote ?? '', chunks, sourcePages, card.sourceChunkId)
  if (!anchored.ok) {
    return { reason: anchored.chunkResolved ? anchored.reason : 'unknown-chunk' }
  }

  const generated: GeneratedCard = {
    id: `webllm-${anchored.chunk.id}-${position}`,
    question,
    options,
    correctIndex,
    sourcePage: anchored.chunk.pageNumber,
    sourceQuote: anchored.quote,
    sourceChunkId: anchored.chunk.id,
    generationMode: 'local-private',
    generationMethod: 'webllm',
    createdAt: now(),
  }

  // The unchanged evidence gate still runs against the real page text.
  return validateGeneratedCard(generated, sourcePages).valid
    ? { card: generated }
    : { reason: 'validation-failed' }
}

export const analyseModelCards = (
  content: string,
  chunks: SourceChunk[],
  sourcePages: SourcePage[],
  now: () => string = () => new Date().toISOString(),
): ModelCardAnalysis => {
  const extracted = extractJson(content)
  if (extracted === undefined) {
    return { cards: [], candidateCount: 0, rejections: ['invalid-json'] }
  }

  const candidates = unwrapCandidates(extracted)
  if (candidates === undefined || candidates.length === 0) {
    return { cards: [], candidateCount: 0, rejections: ['schema'] }
  }

  const cards: GeneratedCard[] = []
  const rejections: CardRejectionReason[] = []
  candidates.forEach((raw, index) => {
    const outcome = analyseCandidate(raw, index + 1, chunks, sourcePages, now)
    if ('card' in outcome) {
      cards.push(outcome.card)
    } else {
      rejections.push(outcome.reason)
    }
  })

  return { cards, candidateCount: candidates.length, rejections }
}

export const parseModelCards = (
  content: string,
  chunks: SourceChunk[],
  sourcePages: SourcePage[],
  now: () => string = () => new Date().toISOString(),
): GeneratedCard[] => analyseModelCards(content, chunks, sourcePages, now).cards
