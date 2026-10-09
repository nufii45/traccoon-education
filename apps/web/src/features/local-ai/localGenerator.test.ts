import { describe, expect, it } from 'vitest'
import { validateGeneratedCard } from './cardRules'
import { parseModelCards } from './localGenerator'
import type { SourceChunk, SourcePage } from './types'

const pages: SourcePage[] = [
  {
    id: 'page-1',
    pageNumber: 1,
    text: 'Plants use chlorophyll to capture light during photosynthesis.',
  },
]

const chunks: SourceChunk[] = [
  {
    id: 'page-1-chunk-1',
    pageNumber: 1,
    text: 'Plants use chlorophyll to capture light during photosynthesis.',
  },
]

describe('parseModelCards', () => {
  it('only admits a source-linked local model response that passes validation', () => {
    const cards = parseModelCards(
      JSON.stringify([
        {
          question: 'What do plants use chlorophyll to capture?',
          options: ['Light', 'Sound', 'Water', 'Soil'],
          correctIndex: 0,
          sourcePage: 1,
          sourceQuote: chunks[0].text,
          sourceChunkId: chunks[0].id,
        },
      ]),
      pages,
      () => '2026-10-09T08:00:00.000Z',
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      generationMode: 'local-private',
      generationMethod: 'webllm',
      sourcePage: 1,
      sourceChunkId: 'page-1-chunk-1',
      sourceQuote: 'Plants use chlorophyll to capture light during photosynthesis.',
    })
    expect(validateGeneratedCard(cards[0], pages)).toEqual({ valid: true, errors: [] })
  })
})
