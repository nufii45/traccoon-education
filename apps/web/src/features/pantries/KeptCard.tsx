import {
  cardOriginLabel,
  citedTextSource,
  displayModeFor,
  generationModeForPages,
  TEXT_SOURCE_LABELS,
} from '../local-ai/provenance'
import type { SourcePage } from '../local-ai/types'
import { hasSource } from './cardSource'
import type { StoredCard } from './repository'

/**
 * A saved card in the pantry. Badges show where it came from and whether the
 * learner edited it; the footer shows its source, or says it has none. Pass
 * the pantry's pages so Cloud Enhanced pantries never show cards as on-device.
 */
export function KeptCard({ card, sourcePages = [] }: { card: StoredCard; sourcePages?: SourcePage[] }) {
  const pantryMode = generationModeForPages(sourcePages)
  const isCloudEnhanced = displayModeFor(card, pantryMode) === 'cloud-enhanced'
  const textSource = hasSource(card) ? citedTextSource(card, sourcePages) : undefined

  return (
    <article className="kept-card">
      <div className="kept-card-badges">
        <span className={isCloudEnhanced ? 'local-badge cloud' : 'local-badge'}>{cardOriginLabel(card, pantryMode)}</span>
        {card.isEdited ? <span className="local-badge edited">Edited</span> : null}
      </div>
      <h3>{card.question}</h3>
      <p>Correct answer: <strong>{card.options[card.correctIndex]}</strong></p>
      <footer>
        {hasSource(card)
          ? `p. ${card.sourcePage}${textSource ? ` · ${TEXT_SOURCE_LABELS[textSource]}` : ''} · “${card.sourceQuote}”`
          : 'No source · written by hand'}
      </footer>
    </article>
  )
}
