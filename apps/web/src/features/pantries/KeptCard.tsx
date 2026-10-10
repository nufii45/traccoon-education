import { useState } from 'react'
import { FileSearchIcon } from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
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
 * A saved card in the pantry, shown compactly: badges, the question, the one
 * key answer on a highlighted surface, and a footer. The full source quote is
 * hidden behind a "View source" disclosure so a long passage never dominates
 * the card; an optional explanation sits behind the same disclosure. Pass the
 * pantry's pages so Cloud Enhanced pantries never show cards as on-device.
 */
export function KeptCard({ card, sourcePages = [] }: { card: StoredCard; sourcePages?: SourcePage[] }) {
  const [sourceOpen, setSourceOpen] = useState(false)
  const sourcePanelId = `kept-source-${card.id}`
  const explanation = card.explanation?.trim()
  const pantryMode = generationModeForPages(sourcePages)
  const isCloudEnhanced = displayModeFor(card, pantryMode) === 'cloud-enhanced'
  const textSource = hasSource(card) ? citedTextSource(card, sourcePages) : undefined
  const textSourceLabel = textSource ? ` · ${TEXT_SOURCE_LABELS[textSource]}` : ''

  return (
    <article className="kept-card">
      <div className="kept-card-badges">
        <span className={isCloudEnhanced ? 'local-badge cloud' : 'local-badge'}>{cardOriginLabel(card, pantryMode)}</span>
        {card.isEdited ? <span className="local-badge edited">Edited</span> : null}
      </div>
      <h3 className="kept-card-question">{card.question}</h3>
      <p className="kept-card-answer">
        <span className="kept-card-answer-label">Answer</span>
        <strong>{card.options[card.correctIndex]}</strong>
      </p>
      <footer className="kept-card-footer">
        {hasSource(card) || explanation ? (
          <button
            aria-controls={sourcePanelId}
            aria-expanded={sourceOpen}
            className="text-button kept-source-toggle"
            onClick={() => setSourceOpen((open) => !open)}
            type="button"
          >
            <Icon icon={FileSearchIcon} size={16} />
            {sourceOpen
              ? 'Hide source'
              : hasSource(card)
                ? `Page ${card.sourcePage}${textSourceLabel} · View source`
                : 'View explanation'}
          </button>
        ) : (
          <span className="kept-source-none">No source · written by hand</span>
        )}
      </footer>
      {sourceOpen ? (
        <div className="kept-source-panel" id={sourcePanelId}>
          {hasSource(card) ? (
            <blockquote className="kept-source-quote">
              <span className="kept-source-page">Page {card.sourcePage}{textSourceLabel}</span>
              “{card.sourceQuote}”
            </blockquote>
          ) : null}
          {explanation ? <p className="kept-source-explanation">{explanation}</p> : null}
        </div>
      ) : null}
    </article>
  )
}
