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

const extractJsonArray = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? content.slice(content.indexOf('['), content.lastIndexOf(']') + 1)
  return JSON.parse(candidate) as unknown
}

export const parseModelCards = (
  content: string,
  sourcePages: SourcePage[],
  now: () => string = () => new Date().toISOString(),
): GeneratedCard[] => {
  const parsed = modelResponseSchema.safeParse(extractJsonArray(content))

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
