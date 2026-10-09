export interface QuoteHighlight {
  before: string
  match: string
  after: string
}

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

/**
 * Locates a card's source quote inside its page text so the source view can
 * mark it. Matching ignores case and whitespace runs, mirroring how page text
 * is stored. Returns undefined when the exact passage cannot be located, so
 * the caller can show the quote on its own instead of a wrong highlight.
 */
export const findQuoteHighlight = (pageText: string, quote: string): QuoteHighlight | undefined => {
  const text = collapseWhitespace(pageText)
  const target = collapseWhitespace(quote)
  if (target.length === 0) {
    return undefined
  }

  // Lowercasing can change string length (e.g. 'İ'), which would shift indexes.
  // In that rare case, fall back to a case-sensitive search.
  const loweredText = text.toLocaleLowerCase()
  const loweredTarget = target.toLocaleLowerCase()
  const isCaseFoldSafe = loweredText.length === text.length && loweredTarget.length === target.length
  const start = isCaseFoldSafe ? loweredText.indexOf(loweredTarget) : text.indexOf(target)
  if (start === -1) {
    return undefined
  }

  const end = start + target.length
  return { before: text.slice(0, start), match: text.slice(start, end), after: text.slice(end) }
}
