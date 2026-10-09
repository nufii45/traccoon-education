import type { GeneratedCard, SourcePage } from './types'
import { isQuoteOnSourcePage, normaliseEvidenceText } from './cardRules'
import { MIN_NORMALIZED_QUOTE_CHARS } from './policy'

export type AnswerEvidence =
  | { status: 'source-linked' }
  | {
      status: 'needs-review'
      reason:
        | 'no-source'
        | 'quote-missing'
        | 'answer-not-in-quote'
        | 'condition-not-in-quote'
        | 'competing-answer-in-quote'
    }

const containsPhrase = (text: string, phrase: string): boolean => {
  if (phrase.length === 0) return false
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text)
}

const quantities = (text: string): string[] =>
  [...text.matchAll(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?(?![\p{L}\p{N}])/gu)].map((match) => match[0])

const questionConditions = (question: string): string[] => {
  const normalisedQuestion = normaliseEvidenceText(question)
  return [...normalisedQuestion.matchAll(/\b(?:on|in|with|under|using|at|during)\s+([^?!.,;:]+)/gu)]
    .map((match) => match[1].split(/\b(?:take|takes|took|do|does|did|is|are|was|were|has|have|had|will|can|could|should|would|to|that|which|who|when|while|compared)\b/u)[0].trim())
    .filter((phrase) => phrase.split(/\s+/u).length >= 2)
}

/**
 * Checks that the saved answer occurs in a real cited passage. Source-linked
 * means only that the text is linked; it does not prove the answer is correct.
 */
export const assessAnswerEvidence = (
  card: Pick<GeneratedCard, 'question' | 'options' | 'correctIndex' | 'sourcePage' | 'sourceQuote' | 'generationMethod'>,
  pages: SourcePage[],
): AnswerEvidence => {
  if (card.sourceQuote.trim().length === 0) {
    return { status: 'needs-review', reason: 'no-source' }
  }

  const page = pages.find((candidate) => candidate.pageNumber === card.sourcePage)
  const quote = normaliseEvidenceText(card.sourceQuote)
  if (!page || quote.length < MIN_NORMALIZED_QUOTE_CHARS || !isQuoteOnSourcePage(card.sourceQuote, page)) {
    return { status: 'needs-review', reason: 'quote-missing' }
  }

  const answer = card.options[card.correctIndex]
  const normalisedAnswer = answer ? normaliseEvidenceText(answer) : ''
  if (!containsPhrase(quote, normalisedAnswer)) {
    return { status: 'needs-review', reason: 'answer-not-in-quote' }
  }

  const answerQuantities = new Set(quantities(normalisedAnswer))
  if (answerQuantities.size > 0) {
    // Require explicit condition wording in the same quote before linking a
    // numeric answer. Paraphrased conditions remain for learner review.
    if (questionConditions(card.question).some((condition) => !containsPhrase(quote, condition))) {
      return { status: 'needs-review', reason: 'condition-not-in-quote' }
    }

    // A second quantity may describe another condition even if it was not
    // offered as a choice. Leave that relationship for learner review.
    if (quantities(quote).some((quantity) => !answerQuantities.has(quantity))) {
      return { status: 'needs-review', reason: 'competing-answer-in-quote' }
    }
  }

  return { status: 'source-linked' }
}
