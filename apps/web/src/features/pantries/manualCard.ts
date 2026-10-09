import { validateGeneratedCard } from '../local-ai/cardRules'
import type { GeneratedCard, SourcePage } from '../local-ai/types'

export interface ManualCardDraft {
  question: string
  options: string[]
  correctIndex: number | null
  sourcePage: number | null
  sourceQuote: string
}

export const emptyManualDraft = (): ManualCardDraft => ({
  question: '',
  options: ['', '', '', ''],
  correctIndex: null,
  sourcePage: null,
  sourceQuote: '',
})

const NO_SOURCE_PAGE = 0

/**
 * Builds a manual card from the form. The source is optional; when the
 * learner adds a quote it is held to the same evidence rules as generated
 * cards via validateGeneratedCard.
 * @returns The card, or the list of problems to show the learner.
 */
export const buildManualCard = (
  draft: ManualCardDraft,
  sourcePages: SourcePage[],
  identity: { id: string; createdAt: string },
): { card: GeneratedCard; errors: [] } | { card: undefined; errors: string[] } => {
  const errors: string[] = []
  const options = draft.options.map((option) => option.trim())

  if (draft.question.trim().length === 0) {
    errors.push('Write a question.')
  }
  if (options.some((option) => option.length === 0)) {
    errors.push('Fill in all four options.')
  } else if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== 4) {
    errors.push('Options must all be different.')
  }
  if (draft.correctIndex === null) {
    errors.push('Pick the correct answer.')
  }

  const quote = draft.sourceQuote.trim()
  if (quote.length > 0 && draft.sourcePage === null) {
    errors.push('Choose the page this quote comes from.')
  }
  if (errors.length > 0) {
    return { card: undefined, errors }
  }

  const sourcePage = quote.length > 0 ? (draft.sourcePage as number) : NO_SOURCE_PAGE
  const card: GeneratedCard = {
    id: identity.id,
    question: draft.question.trim(),
    options,
    correctIndex: draft.correctIndex as number,
    sourcePage,
    sourceQuote: quote,
    sourceChunkId: quote.length > 0 ? `manual-page-${sourcePage}` : '',
    generationMode: 'local-private',
    generationMethod: 'manual',
    createdAt: identity.createdAt,
  }

  if (quote.length > 0) {
    const validation = validateGeneratedCard(card, sourcePages)
    if (!validation.valid) {
      return { card: undefined, errors: validation.errors }
    }
  }

  return { card, errors: [] }
}
