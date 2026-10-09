import { describe, expect, it } from 'vitest'
import { assessAnswerEvidence } from './answerEvidence'
import type { GeneratedCard, SourcePage } from './types'

const pages: SourcePage[] = [
  {
    id: 'page-6',
    pageNumber: 6,
    text: 'Bitongol seeds on moistened paper towels took 15 days to germinate. Seeds in potting medium took 39 days.',
  },
  {
    id: 'page-7',
    pageNumber: 7,
    text: 'The seedlings were measured again after germination had finished.',
  },
]

const card: Pick<GeneratedCard, 'question' | 'options' | 'correctIndex' | 'sourcePage' | 'sourceQuote' | 'generationMethod'> = {
  question: 'How long did Bitongol seeds on moistened paper towels take to germinate?',
  options: ['15 days', '39 days', '7 days', '60 days'],
  correctIndex: 0,
  sourcePage: 6,
  sourceQuote: 'Bitongol seeds on moistened paper towels took 15 days to germinate.',
  generationMethod: 'webllm',
}

describe('assessAnswerEvidence', () => {
  it('links a saved answer when it appears alone in a quote on the cited page', () => {
    expect(assessAnswerEvidence(card, pages)).toEqual({ status: 'source-linked' })
  })

  it('requires the quote to occur on the cited page', () => {
    expect(assessAnswerEvidence({ ...card, sourcePage: 7 }, pages)).toEqual({
      status: 'needs-review',
      reason: 'quote-missing',
    })
  })

  it('does not link 39 days to a paper-towel quote that says 15 days', () => {
    expect(assessAnswerEvidence({ ...card, correctIndex: 1 }, pages)).toEqual({
      status: 'needs-review',
      reason: 'answer-not-in-quote',
    })
  })

  it('does not link 39 days from potting medium to a paper-towel question', () => {
    expect(assessAnswerEvidence({
      ...card,
      correctIndex: 1,
      sourceQuote: 'Seeds in potting medium took 39 days.',
    }, pages)).toEqual({
      status: 'needs-review',
      reason: 'condition-not-in-quote',
    })
  })

  it('requires review when a quantitative quote also contains a competing option', () => {
    expect(assessAnswerEvidence({ ...card, sourceQuote: pages[0].text }, pages)).toEqual({
      status: 'needs-review',
      reason: 'competing-answer-in-quote',
    })
  })

  it('requires review when a different number in the quote is not an answer option', () => {
    expect(assessAnswerEvidence({
      ...card,
      options: ['39 days', '7 days', '60 days', '90 days'],
      sourceQuote: pages[0].text,
    }, pages)).toEqual({
      status: 'needs-review',
      reason: 'competing-answer-in-quote',
    })
  })

  it('requires review for a manual card without a source', () => {
    expect(assessAnswerEvidence({ ...card, generationMethod: 'manual', sourcePage: 0, sourceQuote: '' }, pages)).toEqual({
      status: 'needs-review',
      reason: 'no-source',
    })
  })

  it('rechecks the edited answer instead of trusting the original answer', () => {
    const editedCard = { ...card, correctIndex: 1, isEdited: true }
    expect(assessAnswerEvidence(editedCard, pages)).toEqual({
      status: 'needs-review',
      reason: 'answer-not-in-quote',
    })
  })

  it('requires the saved nonnumeric answer to appear in the quote', () => {
    expect(assessAnswerEvidence({ ...card, options: ['Soon', 'Later', 'Never', 'Sometimes'] }, pages)).toEqual({
      status: 'needs-review',
      reason: 'answer-not-in-quote',
    })
  })
})
