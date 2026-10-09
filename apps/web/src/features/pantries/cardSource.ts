import type { GeneratedCard } from '../local-ai/types'

/**
 * Manual cards may be saved without a source (decision 2026-10-09). They are
 * stored with an empty quote and chunk and sourcePage 0, and every view asks
 * this helper instead of reading those fields directly.
 */
export const hasSource = (card: Pick<GeneratedCard, 'sourceQuote'>) => card.sourceQuote.trim().length > 0
