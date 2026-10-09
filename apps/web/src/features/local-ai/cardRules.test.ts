import { describe, expect, it } from 'vitest'
import { validateGeneratedCard } from './cardRules'
import { MIN_NORMALIZED_QUOTE_CHARS } from './policy'
import type { GeneratedCard, SourcePage } from './types'

const pages: SourcePage[] = [
  {
    id: 'page-1',
    pageNumber: 1,
    text: 'Photosynthesis turns light energy into chemical energy in plants.',
  },
]

const validCard: GeneratedCard = {
  id: 'card-1',
  question: 'What does photosynthesis turn light energy into?',
  options: ['Chemical energy', 'Sound energy', 'Kinetic energy', 'Heat energy'],
  correctIndex: 0,
  sourcePage: 1,
  sourceQuote: 'Photosynthesis turns light energy into chemical energy in plants.',
  sourceChunkId: 'page-1-chunk-1',
  generationMode: 'local-private',
  createdAt: '2026-10-09T08:00:00.000Z',
}

describe('validateGeneratedCard', () => {
  it('accepts an evidence-linked local card', () => {
    expect(validateGeneratedCard(validCard, pages)).toEqual({ valid: true, errors: [] })
  })

  it('rejects options that are not four distinct nonempty choices', () => {
    const invalid = {
      ...validCard,
      options: ['Chemical energy', 'Chemical energy', '', 'Heat energy'],
    }

    expect(validateGeneratedCard(invalid, pages)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(['Options must be four distinct, nonempty choices.']),
    })
  })

  it('rejects a quote that is not on the cited local page', () => {
    const invalid = { ...validCard, sourceQuote: 'This sentence does not exist.' }

    expect(validateGeneratedCard(invalid, pages)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(['Source quote is not present on the cited page.']),
    })
  })

  it('rejects a quote that is shorter than the shared evidence minimum', () => {
    const invalid = { ...validCard, sourceQuote: 'Photosynthesis' }

    expect(validateGeneratedCard(invalid, pages)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        `Source quote must contain at least ${MIN_NORMALIZED_QUOTE_CHARS} normalized characters.`,
      ]),
    })
  })
})
