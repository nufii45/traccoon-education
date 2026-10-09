import { z } from 'zod'
import { validateGeneratedCard } from './cardRules'
import { MAX_CARDS_PER_RUN } from './policy'
import type { GeneratedCard, SourceChunk, SourcePage } from './types'

const modelCardSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  sourcePage: z.number().int().positive(),
  sourceQuote: z.string().min(1),
  sourceChunkId: z.string().min(1),
})

const modelResponseSchema = z.array(modelCardSchema).min(1).max(MAX_CARDS_PER_RUN)

export const buildLocalGenerationPrompt = (chunks: SourceChunk[], requestedCount: number) => {
  const sources = chunks
    .map(
      (chunk) =>
        `SOURCE_CHUNK id=${chunk.id} page=${chunk.pageNumber}\n${chunk.text}\nEND_SOURCE_CHUNK`,
    )
    .join('\n\n')

  return `Create no more than ${Math.min(requestedCount, MAX_CARDS_PER_RUN)} high-quality multiple-choice study cards from the source chunks below.
Return only a JSON array. Each object must have question, options, correctIndex, sourcePage, sourceQuote, and sourceChunkId.
Each options array must contain exactly four distinct nonempty strings. The sourceQuote must be copied verbatim from its cited source chunk. Do not use any fact not present in the source chunks.

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

// Returns parsed model output on success or `undefined` on unrecoverable
// output. Never throws, so parseModelCards can treat failure as "return []".
const extractJsonArray = (content: string): unknown => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const start = content.indexOf('[')
  const end = content.lastIndexOf(']')
  const candidate = fenced ?? (start >= 0 && end > start ? content.slice(start, end + 1) : content)

  const strict = tryParse(candidate)
  if (strict !== undefined) {
    return strict
  }

  const repaired = tryParse(stripTrailingCommas(candidate))
  if (repaired !== undefined) {
    return repaired
  }

  // Salvage scans the full region from the first '[' to the end of the output so
  // a truncated array (cut off by max_tokens) still yields its complete objects.
  const salvageRegion = fenced ?? (start >= 0 ? content.slice(start) : content)
  const salvaged = salvageObjects(salvageRegion)
  if (salvaged.length > 0) {
    return salvaged
  }

  return undefined
}

export const parseModelCards = (
  content: string,
  sourcePages: SourcePage[],
  now: () => string = () => new Date().toISOString(),
): GeneratedCard[] => {
  const extracted = extractJsonArray(content)
  if (extracted === undefined) {
    return []
  }

  const parsed = modelResponseSchema.safeParse(extracted)

  if (!parsed.success) {
    return []
  }

  return parsed.data.flatMap((card, index) => {
    const generated: GeneratedCard = {
      ...card,
      id: `webllm-${card.sourceChunkId}-${index + 1}`,
      generationMode: 'local-private',
      generationMethod: 'webllm',
      createdAt: now(),
    }

    return validateGeneratedCard(generated, sourcePages).valid ? [generated] : []
  })
}
