import { describe, expect, it } from 'vitest'
import type { GeneratedCard } from '../local-ai/types'
import { isCardEdited } from './cardEdits'

const card: GeneratedCard = {
  id: 'card-1',
  question: 'Where does the Krebs cycle take place?',
  options: ['Cytoplasm', 'Mitochondrial matrix', 'Nucleus', 'Ribosome'],
  correctIndex: 1,
  sourcePage: 12,
  sourceQuote: 'The Krebs cycle takes place in the mitochondrial matrix',
  sourceChunkId: 'chunk-12',
  generationMode: 'local-private',
  generationMethod: 'webllm',
  createdAt: '2026-10-09T10:00:00.000Z',
}

describe('isCardEdited', () => {
  it('ignores untouched cards and whitespace-only changes', () => {
    expect(isCardEdited(card, { ...card })).toBe(false)
    expect(isCardEdited(card, { ...card, question: `${card.question} ` })).toBe(false)
  })

  it('flags changes to the question, an option, the answer, or the quote', () => {
    expect(isCardEdited(card, { ...card, question: 'Where is the Krebs cycle?' })).toBe(true)
    expect(isCardEdited(card, { ...card, options: ['Cytosol', ...card.options.slice(1)] })).toBe(true)
    expect(isCardEdited(card, { ...card, correctIndex: 0 })).toBe(true)
    expect(isCardEdited(card, { ...card, sourceQuote: 'The Krebs cycle takes place in the mitochondrial' })).toBe(true)
  })
})
