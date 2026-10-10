import type { GeneratedCard, GenerationMode, SourcePage, TextSource } from './types'

export const TEXT_SOURCE_LABELS: Record<TextSource, string> = {
  'text-layer': 'PDF text',
  'local-ocr': 'On-device OCR',
  'cloud-ocr': 'Cloud OCR',
}

export const GENERATION_MODE_LABELS: Record<GenerationMode, string> = {
  'local-private': 'Local Private',
  'cloud-enhanced': 'Cloud Enhanced',
}

/** Shown in place of a text-source label for a page that has no text yet. */
export const NO_TEXT_LAYER_LABEL = 'No text layer'

/** Pages saved before provenance was recorded came from the PDF text layer. */
export const textSourceOf = (page: Pick<SourcePage, 'textSource'>): TextSource => page.textSource ?? 'text-layer'

/** True when a page has text that chunking and quote checks can use. */
export const hasUsablePageText = (page: Pick<SourcePage, 'text'>): boolean => page.text.trim().length > 0

/** The picker label for a page: its text source, or that it still needs OCR. */
export const pageTextLabel = (page: Pick<SourcePage, 'text' | 'textSource'>): string =>
  hasUsablePageText(page) ? TEXT_SOURCE_LABELS[textSourceOf(page)] : NO_TEXT_LAYER_LABEL

/** Cloud Enhanced as soon as any page's text came from Cloud OCR, otherwise Local Private. */
export const generationModeForPages = (pages: ReadonlyArray<Pick<SourcePage, 'textSource'>>): GenerationMode =>
  pages.some((page) => page.textSource === 'cloud-ocr') ? 'cloud-enhanced' : 'local-private'

/** A Cloud Enhanced card, or any card in a Cloud Enhanced pantry, is never shown as Local Private. */
export const displayModeFor = (
  card: Pick<GeneratedCard, 'generationMode'>,
  pantryMode: GenerationMode,
): GenerationMode =>
  card.generationMode === 'cloud-enhanced' || pantryMode === 'cloud-enhanced' ? 'cloud-enhanced' : 'local-private'

/** Badge text for where a card came from. */
export const cardOriginLabel = (
  card: Pick<GeneratedCard, 'generationMethod' | 'generationMode'>,
  pantryMode: GenerationMode,
): string => {
  const isCloudEnhanced = displayModeFor(card, pantryMode) === 'cloud-enhanced'
  if (card.generationMethod === 'manual') {
    return isCloudEnhanced ? 'Manual · Cloud Enhanced' : 'Manual'
  }
  return isCloudEnhanced ? GENERATION_MODE_LABELS['cloud-enhanced'] : 'On-device'
}

/** The text source of the page a card cites, or `undefined` when that page is not stored. */
export const citedTextSource = (
  card: Pick<GeneratedCard, 'sourcePage'>,
  pages: ReadonlyArray<SourcePage>,
): TextSource | undefined => {
  const page = pages.find((candidate) => candidate.pageNumber === card.sourcePage)
  return page ? textSourceOf(page) : undefined
}

/** "page 2", "pages 2 and 3", or "pages 1, 2, and 3". */
export const formatPageList = (pageNumbers: readonly number[]): string => {
  const numbers = pageNumbers.map(String)
  if (numbers.length <= 1) {
    return `page ${numbers[0] ?? ''}`.trim()
  }
  if (numbers.length === 2) {
    return `pages ${numbers[0]} and ${numbers[1]}`
  }
  return `pages ${numbers.slice(0, -1).join(', ')}, and ${numbers[numbers.length - 1]}`
}
