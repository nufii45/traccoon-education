import { normaliseEvidenceText } from './cardRules'
import {
  DUPLICATE_QUESTION_SIMILARITY,
  MAX_ANSWER_WORDS,
  MAX_QUESTION_WORDS,
  MIN_QUESTION_WORDS,
} from './policy'
import type { GeneratedCard } from './types'

/**
 * Concise-card quality gate. These checks run after the evidence gate
 * (`validateGeneratedCard`), which already proves the quote exists on the
 * cited page. They add two things the quote match cannot:
 *
 *  1. Length discipline, so a card stays bite-sized (one fact, one short
 *     answer) instead of a verbose paragraph.
 *  2. Semantic correctness, so the marked answer is actually supported by the
 *     quote and does not contradict a condition the question states.
 *
 * A quote matching only proves the passage exists; it never proves the marked
 * option is the right one. These heuristics reject the clearest conflicts
 * (a numeric answer absent from, or contradicted by, the evidence) without
 * claiming to understand prose. They are intentionally conservative: a card is
 * only rejected when the evidence actively disagrees with it.
 */

export type QualityReason =
  | 'question-too-short'
  | 'question-too-long'
  | 'answer-too-long'
  | 'answer-unsupported'
  | 'answer-contradicted'

export interface QualityResult {
  valid: boolean
  reasons: QualityReason[]
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'and', 'or', 'is', 'are',
  'was', 'were', 'be', 'by', 'with', 'as', 'that', 'this', 'it', 'its', 'into',
  'from', 'how', 'what', 'which', 'when', 'where', 'who', 'does', 'do', 'did',
  'long', 'much', 'many', 'take', 'takes', 'using', 'use', 'used',
])

export const wordCount = (value: string): number =>
  normaliseEvidenceText(value).split(' ').filter(Boolean).length

const tokens = (value: string): string[] =>
  normaliseEvidenceText(value).split(/[^\p{L}\p{N}%./-]+/u).filter(Boolean)

const significantTokens = (value: string): string[] =>
  tokens(value).filter((token) => token.length > 1 && !STOP_WORDS.has(token))

// A number with optional unit, percentage, range, or decimal: 39, 25%, 15,
// 530-740, 1.5. These are the facts a flashcard answer most often turns on, so
// a numeric answer that never appears in the quote is a strong miss signal.
const NUMERIC_PATTERN = /\d+(?:[.,]\d+)?/g

const numbers = (value: string): string[] =>
  (normaliseEvidenceText(value).match(NUMERIC_PATTERN) ?? []).map((match) => match.replace(',', ''))

interface QuoteNumber {
  value: string
  index: number
}

// Each number in the quote with the character offset it sits at, so a
// condition word can be matched to its nearest number.
const quoteNumberPositions = (quote: string): QuoteNumber[] => {
  const positions: QuoteNumber[] = []
  for (const match of quote.matchAll(NUMERIC_PATTERN)) {
    positions.push({ value: match[0].replace(',', ''), index: match.index ?? 0 })
  }
  return positions
}

/**
 * Detects the paper-towel vs potting-medium style swap: the quote pairs two
 * values with two different conditions, the question asks about one condition,
 * and the marked answer took the other condition's value.
 *
 * It works by anchoring on the marked answer's number inside the quote and
 * reading the condition words that sit around it. If those surrounding
 * condition words are absent from the question, yet some other number in the
 * quote is flanked by condition words the question *does* name, the answer
 * describes a different condition than the one asked about.
 *
 * Returns true only on that clear conflict, so a single-condition quote or an
 * unlocatable condition never triggers a rejection.
 */
const isAnswerConditionMismatch = (
  question: string,
  sourceQuote: string,
  answerNumbers: string[],
): boolean => {
  const quote = normaliseEvidenceText(sourceQuote)
  const positions = quoteNumberPositions(quote)
  if (positions.length < 2) {
    return false
  }

  const questionConditions = new Set(
    significantTokens(question).filter((word) => !/^\d/.test(word)),
  )
  if (questionConditions.size === 0) {
    return false
  }

  // Split the quote into clauses on connectors and punctuation, then keep only
  // clauses that state a number. Each such clause is one "condition = value"
  // pair (for example "39 days in a potting medium").
  const clauses = quote
    .split(/\s+(?:and|or|but|while|whereas|versus|vs)\s+|[,;:]/)
    .map((clause) => clause.trim())
    .filter((clause) => numbers(clause).length > 0)
  if (clauses.length < 2) {
    return false
  }

  interface Clause {
    numbers: string[]
    words: Set<string>
  }
  const parsed: Clause[] = clauses.map((clause) => ({
    numbers: numbers(clause),
    words: new Set(significantTokens(clause).filter((word) => !/^\d/.test(word))),
  }))

  // Words before the first number are the shared sentence subject (for example
  // "bitongol seeds germinate"), which applies to every value and so cannot
  // select between them. Remove them from every clause before matching.
  const firstNumber = quote.search(NUMERIC_PATTERN)
  NUMERIC_PATTERN.lastIndex = 0
  const subject = new Set(
    firstNumber > 0
      ? significantTokens(quote.slice(0, firstNumber)).filter((word) => !/^\d/.test(word))
      : [],
  )
  for (const clause of parsed) {
    for (const word of subject) {
      clause.words.delete(word)
    }
  }

  // A word shared by two or more clauses is also non-selecting, so it cannot
  // distinguish which value the question wants.
  const wordClauseCount = new Map<string, number>()
  for (const clause of parsed) {
    for (const word of clause.words) {
      wordClauseCount.set(word, (wordClauseCount.get(word) ?? 0) + 1)
    }
  }
  const distinguishing = (clause: Clause): string[] =>
    [...clause.words].filter((word) => (wordClauseCount.get(word) ?? 0) === 1)

  const questionMatch = (clause: Clause) =>
    distinguishing(clause).reduce((total, word) => (questionConditions.has(word) ? total + 1 : total), 0)

  const answerClauses = parsed.filter((clause) => clause.numbers.some((value) => answerNumbers.includes(value)))
  const otherClauses = parsed.filter((clause) => !clause.numbers.some((value) => answerNumbers.includes(value)))
  if (answerClauses.length === 0 || otherClauses.length === 0) {
    return false
  }

  // The question's distinguishing condition sits beside the correct value. If
  // a competing clause's distinguishing words match the question but the
  // marked answer's clause's do not, the answer answers the wrong condition.
  const answerMatch = Math.max(...answerClauses.map(questionMatch))
  const otherMatch = Math.max(...otherClauses.map(questionMatch))

  return otherMatch > 0 && otherMatch > answerMatch
}

/**
 * Checks the concise-length rules and the semantic relationship between the
 * question, the marked answer, and the source quote.
 *
 * - A numeric answer must have each of its numbers present in the quote;
 *   otherwise the evidence does not support it (`answer-unsupported`).
 * - When the quote pairs the question's own numbers with a different value
 *   than the answer, the pair is contradicted (`answer-contradicted`). This
 *   catches the "paper towel vs potting medium" swap where the question names
 *   one condition but the answer took the other condition's number.
 * - A non-numeric answer must share at least one significant word with the
 *   quote, so a plausible-sounding but unsupported option is rejected.
 */
export const checkCardQuality = (card: GeneratedCard): QualityResult => {
  const reasons: QualityReason[] = []

  const questionWords = wordCount(card.question)
  if (questionWords < MIN_QUESTION_WORDS) {
    reasons.push('question-too-short')
  } else if (questionWords > MAX_QUESTION_WORDS) {
    reasons.push('question-too-long')
  }

  const answer = card.options[card.correctIndex] ?? ''
  if (wordCount(answer) > MAX_ANSWER_WORDS) {
    reasons.push('answer-too-long')
  }

  const quote = normaliseEvidenceText(card.sourceQuote)
  const quoteNumbers = numbers(card.sourceQuote)
  const answerNumbers = numbers(answer)

  if (answerNumbers.length > 0) {
    const unsupported = answerNumbers.some((value) => !quoteNumbers.includes(value))
    if (unsupported) {
      reasons.push('answer-unsupported')
    } else if (quoteNumbers.length > 1 && isAnswerConditionMismatch(card.question, card.sourceQuote, answerNumbers)) {
      // The quote states more than one number against different conditions and
      // the marked answer took the one for a condition the question did not
      // ask about (the paper-towel vs potting-medium swap).
      reasons.push('answer-contradicted')
    }
  } else if (answer.trim().length > 0 && quote.length > 0) {
    const answerWords = significantTokens(answer)
    if (answerWords.length > 0) {
      const overlap = answerWords.some((word) => quote.includes(word))
      if (!overlap) {
        reasons.push('answer-unsupported')
      }
    }
  }

  return { valid: reasons.length === 0, reasons }
}

const questionSignatures = (card: GeneratedCard): Set<string> =>
  new Set(significantTokens(card.question))

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) {
    return 0
  }
  let shared = 0
  for (const token of a) {
    if (b.has(token)) {
      shared += 1
    }
  }
  return shared / (a.size + b.size - shared)
}

/**
 * Removes near-duplicate questions from a batch, keeping the first occurrence.
 * Two cards collide when their significant-word sets overlap at or above
 * {@link DUPLICATE_QUESTION_SIMILARITY}. Order is preserved so the earliest
 * (highest-ranked) card for a concept wins, favouring coverage of distinct
 * facts over repeated variations of one. The configured batch cap is applied
 * by the caller, not here.
 */
export const dedupeCards = (cards: GeneratedCard[]): GeneratedCard[] => {
  const kept: { card: GeneratedCard; signature: Set<string> }[] = []

  for (const card of cards) {
    const signature = questionSignatures(card)
    const isDuplicate = kept.some(
      (entry) => jaccard(entry.signature, signature) >= DUPLICATE_QUESTION_SIMILARITY,
    )
    if (!isDuplicate) {
      kept.push({ card, signature })
    }
  }

  return kept.map((entry) => entry.card)
}
