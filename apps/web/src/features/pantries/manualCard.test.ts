import { describe, expect, it } from 'vitest'
import type { SourcePage } from '../local-ai/types'
import { buildManualCard, emptyManualDraft, type ManualCardDraft } from './manualCard'

const identity = { id: 'manual-1', createdAt: '2026-10-09T10:00:00.000Z' }
const pages: SourcePage[] = [
  { id: 'page-12', pageNumber: 12, text: 'The Krebs cycle takes place in the mitochondrial matrix, where acetyl-CoA is oxidized.' },
]
const draft = (changes: Partial<ManualCardDraft> = {}): ManualCardDraft => ({
  ...emptyManualDraft(),
  question: 'Where does the Krebs cycle take place?',
  options: ['Cytoplasm', 'Mitochondrial matrix', 'Nucleus', 'Ribosome'],
  correctIndex: 1,
  ...changes,
})

describe('buildManualCard', () => {
  it('saves a card with no source when none is given', () => {
    const result = buildManualCard(draft(), [], identity)
    expect(result.errors).toEqual([])
    expect(result.card).toMatchObject({
      sourceQuote: '',
      sourceChunkId: '',
      sourcePage: 0,
      generationMethod: 'manual',
      generationMode: 'local-private',
    })
  })

  it('starts with no correct answer and requires one to be picked', () => {
    expect(emptyManualDraft().correctIndex).toBeNull()
    expect(buildManualCard(draft({ correctIndex: null }), [], identity).errors).toContain('Pick the correct answer.')
  })

  it('requires four different, filled-in options and a question', () => {
    expect(buildManualCard(draft({ question: ' ', options: ['A', 'a', 'B', 'C'] }), [], identity).errors).toEqual([
      'Write a question.',
      'Options must all be different.',
    ])
    expect(buildManualCard(draft({ options: ['A', '', 'B', 'C'] }), [], identity).errors).toEqual(['Fill in all four options.'])
  })

  it('holds an optional quote to the same evidence rules as generated cards', () => {
    const onPage = buildManualCard(
      draft({ sourcePage: 12, sourceQuote: 'The Krebs cycle takes place in the mitochondrial matrix' }),
      pages,
      identity,
    )
    expect(onPage.card).toMatchObject({ sourcePage: 12, sourceChunkId: 'manual-page-12' })

    const offPage = buildManualCard(
      draft({ sourcePage: 12, sourceQuote: 'Glycolysis splits glucose into two molecules of pyruvate in the cytoplasm' }),
      pages,
      identity,
    )
    expect(offPage.card).toBeUndefined()
    expect(offPage.errors).toContain('Source quote is not present on the cited page.')
  })

  it('asks for a page when a quote has none', () => {
    expect(buildManualCard(draft({ sourceQuote: 'Some quote' }), pages, identity).errors).toContain(
      'Choose the page this quote comes from.',
    )
  })
})
