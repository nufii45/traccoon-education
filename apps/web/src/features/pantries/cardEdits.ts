import type { GeneratedCard } from '../local-ai/types'

/**
 * True when the learner changed what the card teaches or cites: the
 * question, any option, the correct answer, or the source quote.
 */
export const isCardEdited = (original: GeneratedCard, updated: GeneratedCard) =>
  original.question.trim() !== updated.question.trim() ||
  original.correctIndex !== updated.correctIndex ||
  original.sourceQuote.trim() !== updated.sourceQuote.trim() ||
  original.options.some((option, index) => option.trim() !== (updated.options[index] ?? '').trim())
