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

  const validCard = {
    question: 'What do plants use chlorophyll to capture?',
    options: ['Light', 'Sound', 'Water', 'Soil'],
    correctIndex: 0,
    sourcePage: 1,
    sourceQuote: chunks[0].text,
    sourceChunkId: chunks[0].id,
  }

  const now = () => '2026-10-09T08:00:00.000Z'

  it('tolerates a trailing comma after the last array element', () => {
    const cards = parseModelCards(`[${JSON.stringify(validCard)},]`, pages, now)

    expect(cards).toHaveLength(1)
    expect(validateGeneratedCard(cards[0], pages)).toEqual({ valid: true, errors: [] })
  })

  it('salvages a valid object and drops malformed trailing garbage', () => {
    const content = `[${JSON.stringify(validCard)} this is not valid json at all ]`
    const cards = parseModelCards(content, pages, now)

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ sourceChunkId: 'page-1-chunk-1' })
  })

  it('salvages complete leading objects from an array truncated by max tokens', () => {
    const content = `[${JSON.stringify(validCard)},{"question":"What is`
    const cards = parseModelCards(content, pages, now)

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ sourceChunkId: 'page-1-chunk-1' })
  })

  it('returns an empty array for non-JSON garbage without throwing', () => {
    expect(parseModelCards('Sorry, I cannot answer that right now.', pages, now)).toEqual([])
  })

  it('parses a fenced json block containing a valid array', () => {
    const content = '```json\n' + `[${JSON.stringify(validCard)}]` + '\n```'
    const cards = parseModelCards(content, pages, now)

    expect(cards).toHaveLength(1)
    expect(validateGeneratedCard(cards[0], pages)).toEqual({ valid: true, errors: [] })
  })
})
