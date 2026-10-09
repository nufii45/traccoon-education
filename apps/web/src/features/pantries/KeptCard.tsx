import { hasSource } from './cardSource'
import type { StoredCard } from './repository'

/**
 * A saved card in the pantry. Badges show where it came from and whether the
 * learner edited it; the footer shows its source, or says it has none.
 */
export function KeptCard({ card }: { card: StoredCard }) {
  return (
    <article className="kept-card">
      <div className="kept-card-badges">
        <span className="local-badge">{card.generationMethod === 'manual' ? 'Manual' : 'On-device'}</span>
        {card.isEdited ? <span className="local-badge edited">Edited</span> : null}
      </div>
      <h3>{card.question}</h3>
      <p>Correct answer: <strong>{card.options[card.correctIndex]}</strong></p>
      <footer>{hasSource(card) ? `p. ${card.sourcePage} · “${card.sourceQuote}”` : 'No source · written by hand'}</footer>
    </article>
  )
}
