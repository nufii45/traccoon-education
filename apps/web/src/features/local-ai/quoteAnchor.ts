import { isQuoteOnSourcePage, normaliseEvidenceText } from './cardRules'
import { MIN_NORMALIZED_QUOTE_CHARS } from './policy'
import type { SourceChunk, SourcePage } from './types'

// Minimum token-overlap F1 between the model quote and a real chunk span.
// Fixtures for a dropped word, a trailing ellipsis, quote/dash swaps, and two
// merged sentences score at least 0.75; an unrelated same-topic sentence
// scores well under 0.5. The anchored quote is always verbatim chunk text, so
// this threshold only decides which real sentence the model pointed at.
export const QUOTE_ANCHOR_MIN_SCORE = 0.6

// A contiguous normalised match of at least this many tokens is treated as a
// strong match even when the surrounding sentence is much longer.
const SUBSTRING_BONUS_MIN_TOKENS = 5
const SUBSTRING_BONUS_SCORE = 0.85
const MIN_QUOTE_TOKENS = 3

export type QuoteAnchorFailure = 'quote-not-found' | 'quote-too-short'

export type QuoteAnchorResult =
  | { ok: true; quote: string; chunk: SourceChunk; score: number }
  | { ok: false; reason: QuoteAnchorFailure }

export type ChunkQuoteAnchorResult = QuoteAnchorResult & { chunkResolved: boolean }

interface SentenceSpan {
  start: number
  end: number
}

interface Candidate {
  first: number
  last: number
  score: number
}

const tokenise = (value: string): string[] =>
  normaliseEvidenceText(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean)

const sentenceSpans = (text: string): SentenceSpan[] => {
  const spans: SentenceSpan[] = []

  for (const match of text.matchAll(/[^.!?]+[.!?]+|[^.!?]+$/g)) {
    const raw = match[0]
    const leading = raw.length - raw.trimStart().length
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      continue
    }
    const start = (match.index ?? 0) + leading
    spans.push({ start, end: start + trimmed.length })
  }

  return spans
}

const countTokens = (tokens: string[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

const scoreCandidate = (quoteTokens: string[], quoteCounts: Map<string, number>, candidateTokens: string[]) => {
  if (candidateTokens.length === 0) {
    return 0
  }

  const candidateCounts = countTokens(candidateTokens)
  let overlap = 0
  for (const [token, count] of quoteCounts) {
    overlap += Math.min(count, candidateCounts.get(token) ?? 0)
  }

  const precision = overlap / candidateTokens.length
  const recall = overlap / quoteTokens.length
  const f1 = overlap === 0 ? 0 : (2 * precision * recall) / (precision + recall)

  if (
    quoteTokens.length >= SUBSTRING_BONUS_MIN_TOKENS
    && ` ${candidateTokens.join(' ')} `.includes(` ${quoteTokens.join(' ')} `)
  ) {
    return Math.max(f1, SUBSTRING_BONUS_SCORE)
  }

  return f1
}

const spanText = (text: string, spans: SentenceSpan[], first: number, last: number) =>
  text.slice(spans[first].start, spans[last].end)

// Anchors a model quote to a verbatim span of one chunk. The returned quote is
// always original chunk text and is re-checked against the cited page.
export const anchorQuoteInChunk = (
  quote: string,
  chunk: SourceChunk,
  page: SourcePage,
): QuoteAnchorResult => {
  const quoteTokens = tokenise(quote)
  if (quoteTokens.length < MIN_QUOTE_TOKENS) {
    return { ok: false, reason: 'quote-not-found' }
  }

  const spans = sentenceSpans(chunk.text)
  if (spans.length === 0) {
    return { ok: false, reason: 'quote-not-found' }
  }

  const quoteCounts = countTokens(quoteTokens)
  const candidates: Candidate[] = []
  for (let index = 0; index < spans.length; index += 1) {
    const lastIndex = Math.min(index + 1, spans.length - 1)
    for (let last = index; last <= lastIndex; last += 1) {
      const tokens = tokenise(spanText(chunk.text, spans, index, last))
      candidates.push({ first: index, last, score: scoreCandidate(quoteTokens, quoteCounts, tokens) })
    }
  }

  const ranked = candidates
    .filter((candidate) => candidate.score >= QUOTE_ANCHOR_MIN_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score
        || (a.last - a.first) - (b.last - b.first)
        || spans[a.first].start - spans[b.first].start,
    )

  let tooShort = 0
  for (const candidate of ranked) {
    let { first, last } = candidate
    let text = spanText(chunk.text, spans, first, last)

    // Extend a short sentence with its neighbour so the quote meets the
    // shared evidence minimum; prefer the following sentence.
    while (normaliseEvidenceText(text).length < MIN_NORMALIZED_QUOTE_CHARS) {
      if (last + 1 < spans.length) {
        last += 1
      } else if (first > 0) {
        first -= 1
      } else {
        break
      }
      text = spanText(chunk.text, spans, first, last)
    }

    if (normaliseEvidenceText(text).length < MIN_NORMALIZED_QUOTE_CHARS) {
      tooShort += 1
      continue
    }

    if (isQuoteOnSourcePage(text, page)) {
      return { ok: true, quote: text, chunk, score: candidate.score }
    }
  }

  return {
    ok: false,
    reason: ranked.length > 0 && tooShort === ranked.length ? 'quote-too-short' : 'quote-not-found',
  }
}

const resolveChunkId = (value: string | undefined) => value?.trim().replace(/^id\s*=\s*/i, '').trim() ?? ''

// Tries the chunk the model cited first, then every chunk, so a card is
// attributed to the chunk that really contains the anchored span.
export const anchorQuote = (
  quote: string,
  chunks: SourceChunk[],
  pages: SourcePage[],
  preferredChunkId?: string,
): ChunkQuoteAnchorResult => {
  const preferredId = resolveChunkId(preferredChunkId)
  const preferred = preferredId ? chunks.find((chunk) => chunk.id === preferredId) : undefined
  const chunkResolved = preferred !== undefined
  const pageFor = (chunk: SourceChunk) => pages.find((page) => page.pageNumber === chunk.pageNumber)

  const tryChunk = (chunk: SourceChunk): QuoteAnchorResult => {
    const page = pageFor(chunk)
    return page ? anchorQuoteInChunk(quote, chunk, page) : { ok: false, reason: 'quote-not-found' }
  }

  if (preferred) {
    const result = tryChunk(preferred)
    if (result.ok) {
      return { ...result, chunkResolved }
    }
  }

  let best: QuoteAnchorResult | undefined
  let sawTooShort = false
  for (const chunk of chunks) {
    const result = tryChunk(chunk)
    if (result.ok) {
      if (!best?.ok || result.score > best.score) {
        best = result
      }
    } else if (result.reason === 'quote-too-short') {
      sawTooShort = true
    }
  }

  if (best?.ok) {
    return { ...best, chunkResolved }
  }

  return { ok: false, reason: sawTooShort ? 'quote-too-short' : 'quote-not-found', chunkResolved }
}
