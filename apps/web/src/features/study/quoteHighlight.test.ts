import { describe, expect, it } from 'vitest'
import { findQuoteHighlight } from './quoteHighlight'

describe('findQuoteHighlight', () => {
  const page = 'When oxygen is available, pyruvate enters the mitochondrion. The Krebs cycle takes place in the matrix.'

  it('splits page text around the quote', () => {
    expect(findQuoteHighlight(page, 'The Krebs cycle takes place')).toEqual({
      before: 'When oxygen is available, pyruvate enters the mitochondrion. ',
      match: 'The Krebs cycle takes place',
      after: ' in the matrix.',
    })
  })

  it('ignores case and whitespace runs but keeps the page casing', () => {
    expect(findQuoteHighlight(page, 'the  krebs\ncycle')?.match).toBe('The Krebs cycle')
  })

  it('returns undefined when the quote is not on the page', () => {
    expect(findQuoteHighlight(page, 'Glycolysis occurs in the cytoplasm')).toBeUndefined()
  })

  it('returns undefined for an empty quote', () => {
    expect(findQuoteHighlight(page, '   ')).toBeUndefined()
  })
})
