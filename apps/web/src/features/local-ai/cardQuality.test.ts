import { describe, expect, it } from 'vitest'
import { checkCardQuality, dedupeCards, wordCount } from './cardQuality'
import type { GeneratedCard } from './types'

const baseCard: GeneratedCard = {
  id: 'card-1',
  question: 'How long do Bitongol seeds take to germinate in a potting medium?',
  options: ['39 days', '15 days', '25 days', '60 days'],
  correctIndex: 0,
  sourcePage: 6,
  sourceQuote:
    'Bitongol seeds germinate in 39 days in a potting medium and in 15 days on a moistened paper towel.',
  sourceChunkId: 'page-6-chunk-1',
  generationMode: 'local-private',
  createdAt: '2026-10-10T00:00:00.000Z',
}

const card = (overrides: Partial<GeneratedCard>): GeneratedCard => ({ ...baseCard, ...overrides })

describe('wordCount', () => {
  it('counts normalized words', () => {
    expect(wordCount('How long do Bitongol seeds take?')).toBe(6)
    expect(wordCount('  spaced   out  ')).toBe(2)
  })
})

describe('checkCardQuality length rules', () => {
  it('accepts a concise, supported card', () => {
    expect(checkCardQuality(baseCard)).toEqual({ valid: true, reasons: [] })
  })

  it('rejects a question that is too short', () => {
    const result = checkCardQuality(card({ question: 'Germination time?' }))
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('question-too-short')
  })

  it('rejects a question that is too long', () => {
    const longQuestion = `How long ${'and '.repeat(30)}do seeds take to germinate?`
    const result = checkCardQuality(card({ question: longQuestion }))
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('question-too-long')
  })

  it('rejects an answer that is too long', () => {
    const result = checkCardQuality(
      card({
        options: [
          'It takes about thirty nine days in a potting medium under the described controlled greenhouse conditions overall most of the time',
          '15 days',
          '25 days',
          '60 days',
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('answer-too-long')
  })
})

describe('checkCardQuality semantic correctness', () => {
  it('rejects a numeric answer absent from the quote', () => {
    const result = checkCardQuality(
      card({ options: ['42 days', '15 days', '25 days', '60 days'] }),
    )
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('answer-unsupported')
  })

  it('flags the paper-towel vs potting-medium mix-up as contradicted', () => {
    // The question asks about a moistened paper towel but the answer took the
    // potting-medium number. The quote carries the real paper-towel value, so
    // the answer belongs to a different condition.
    const result = checkCardQuality(
      card({
        question: 'How long do Bitongol seeds take to germinate on a moistened paper towel?',
        options: ['39 days', '15 days', '25 days', '60 days'],
        correctIndex: 0,
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('answer-contradicted')
  })

  it('accepts the correctly matched paper-towel answer', () => {
    const result = checkCardQuality(
      card({
        question: 'How long do Bitongol seeds take to germinate on a moistened paper towel?',
        options: ['15 days', '39 days', '25 days', '60 days'],
        correctIndex: 0,
      }),
    )
    expect(result).toEqual({ valid: true, reasons: [] })
  })

  it('rejects a word answer with no overlap with the quote', () => {
    const result = checkCardQuality(
      card({
        question: 'What growing medium is used for Guioa bicolor seeds?',
        options: ['Volcanic ash', 'River sand', 'Peat moss', 'Garden loam'],
        correctIndex: 0,
        sourceQuote: 'Guioa bicolor seeds are sorted by colour before sowing, pale seeds first.',
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('answer-unsupported')
  })

  it('accepts a word answer supported by the quote', () => {
    const result = checkCardQuality(
      card({
        question: 'How are Guioa bicolor seeds sorted before sowing?',
        options: ['By colour', 'By weight', 'By size', 'By age'],
        correctIndex: 0,
        sourceQuote: 'Guioa bicolor seeds are sorted by colour before sowing, pale seeds first.',
      }),
    )
    expect(result).toEqual({ valid: true, reasons: [] })
  })
})

describe('dedupeCards', () => {
  it('keeps the first of two near-identical questions', () => {
    const a = card({ id: 'a', question: 'How long do Bitongol seeds take to germinate in a potting medium?' })
    const b = card({ id: 'b', question: 'How long do Bitongol seeds take to germinate using a potting medium?' })
    const result = dedupeCards([a, b])
    expect(result.map((entry) => entry.id)).toEqual(['a'])
  })

  it('keeps cards that cover distinct concepts', () => {
    const germination = card({ id: 'germ', question: 'How long do Bitongol seeds take to germinate in a potting medium?' })
    const percentage = card({ id: 'pct', question: 'What germination percentage do Bitongol seeds reach?' })
    const density = card({ id: 'dens', question: 'What is the density of Guioa wood at fifteen percent moisture?' })
    const result = dedupeCards([germination, percentage, density])
    expect(result.map((entry) => entry.id)).toEqual(['germ', 'pct', 'dens'])
  })

  it('preserves order and does not cap the batch itself', () => {
    const cards = [card({ id: '1', question: 'What is the density of Guioa wood at fifteen percent moisture?' })]
    expect(dedupeCards(cards)).toHaveLength(1)
  })
})
