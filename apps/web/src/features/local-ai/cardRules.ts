import type { CardValidation, GeneratedCard, SourcePage } from './types'
import { MIN_NORMALIZED_QUOTE_CHARS } from './policy'

export const normaliseEvidenceText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/\u00AD/g, '')
    .replace(/([\p{L}])-\s*\n\s*([\p{L}])/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()

export const isQuoteOnSourcePage = (quote: string, page: SourcePage) => {
  const normalisedQuote = normaliseEvidenceText(quote)
  return normalisedQuote.length > 0 && normaliseEvidenceText(page.text).includes(normalisedQuote)
}

export const validateGeneratedCard = (
  card: GeneratedCard,
  sourcePages: SourcePage[],
): CardValidation => {
  const errors: string[] = []
  const options = card.options.map((option) => option.trim())
  const distinctOptions = new Set(options.map((option) => option.toLocaleLowerCase()))
  const citedPage = sourcePages.find((page) => page.pageNumber === card.sourcePage)

  if (card.question.trim().length === 0) {
    errors.push('Question is required.')
  }

  if (options.length !== 4 || options.some((option) => option.length === 0) || distinctOptions.size !== 4) {
    errors.push('Options must be four distinct, nonempty choices.')
  }

  if (!Number.isInteger(card.correctIndex) || card.correctIndex < 0 || card.correctIndex > 3) {
    errors.push('Correct answer must point to one of the four options.')
  }

  if (card.sourceChunkId.trim().length === 0) {
    errors.push('Source chunk is required.')
  }

  if (normaliseEvidenceText(card.sourceQuote).length < MIN_NORMALIZED_QUOTE_CHARS) {
    errors.push(`Source quote must contain at least ${MIN_NORMALIZED_QUOTE_CHARS} normalized characters.`)
  }

  if (!citedPage) {
    errors.push('Cited source page does not exist.')
  } else if (!isQuoteOnSourcePage(card.sourceQuote, citedPage)) {
    errors.push('Source quote is not present on the cited page.')
  }

  // Cloud Enhanced cards come from Cloud OCR page text; generation itself
  // still runs on this device, so both modes pass the same evidence checks.
  if (card.generationMode !== 'local-private' && card.generationMode !== 'cloud-enhanced') {
    errors.push('Cards must be Local Private or Cloud Enhanced.')
  }

  return { valid: errors.length === 0, errors }
}
