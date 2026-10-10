import { useState } from 'react'
import { Cancel01Icon, FileSearchIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import { validateGeneratedCard } from '../local-ai/cardRules'
import {
  cardOriginLabel,
  citedTextSource,
  displayModeFor,
  generationModeForPages,
  TEXT_SOURCE_LABELS,
} from '../local-ai/provenance'
import type { GeneratedCard, SourcePage } from '../local-ai/types'
import { hasSource } from './cardSource'
import { isCardEdited } from './cardEdits'
import type { CardToSave } from './repository'

interface ReviewCardProps {
  card: GeneratedCard
  onDiscard: () => void
  onKeep: (card: CardToSave) => void
  sourcePages: SourcePage[]
}

const letter = (index: number) => String.fromCharCode(65 + index)

/**
 * A generated suggestion the learner can edit, keep, or discard. The default
 * view is compact: a header, the question, the four options with the correct
 * one marked, and a footer. The exact source quote is kept out of the way
 * behind a "View source" disclosure so a long passage never dominates the
 * card, while source verification still runs on keep.
 *
 * Keeping re-runs the evidence check, so an edited quote must still be on its
 * page, and marks the card as edited when anything changed.
 */
export function ReviewCard({ card, onDiscard, onKeep, sourcePages }: ReviewCardProps) {
  const [draft, setDraft] = useState(card)
  const [errors, setErrors] = useState<string[]>([])
  const [sourceOpen, setSourceOpen] = useState(false)

  const changeOption = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (optionIndex === index ? value : option)),
    }))
  }

  const keep = () => {
    const validation = validateGeneratedCard(draft, sourcePages)
    if (!validation.valid) {
      setErrors(validation.errors)
      // Reveal the evidence so a quote problem is visible where it is edited.
      if (validation.errors.some((message) => message.toLowerCase().includes('quote'))) {
        setSourceOpen(true)
      }
      return
    }
    const explanation = draft.explanation?.trim()
    onKeep({ ...draft, explanation: explanation || undefined, isEdited: isCardEdited(card, draft) })
  }

  const sourcePanelId = `review-source-${draft.id}`
  // `sourcePages` holds every page of the pantry, so it decides the pantry's mode.
  const pantryMode = generationModeForPages(sourcePages)
  const isCloudEnhanced = displayModeFor(draft, pantryMode) === 'cloud-enhanced'
  const textSource = citedTextSource(draft, sourcePages)
  const evidenceSource = textSource ? ` · ${TEXT_SOURCE_LABELS[textSource]}` : ''

  return (
    <article className="review-card">
      <header className="review-card-topline">
        <span className={isCloudEnhanced ? 'local-badge cloud' : 'local-badge'}>{cardOriginLabel(draft, pantryMode)}</span>
        <span className="review-card-page">p. {draft.sourcePage}{evidenceSource}</span>
      </header>

      <label className="field-label" htmlFor={`question-${draft.id}`}>Question</label>
      <textarea
        className="review-question"
        id={`question-${draft.id}`}
        onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))}
        value={draft.question}
      />

      <div className="option-list">
        {draft.options.map((option, index) => (
          <label className={index === draft.correctIndex ? 'option correct' : 'option'} key={`${draft.id}-${index}`}>
            <input aria-label={`Mark option ${letter(index)} correct`} checked={index === draft.correctIndex} name={`correct-${draft.id}`} onChange={() => setDraft((current) => ({ ...current, correctIndex: index }))} type="radio" />
            <span>{letter(index)}</span>
            <input aria-label={`Option ${index + 1}`} onChange={(event) => changeOption(index, event.target.value)} value={option} />
          </label>
        ))}
      </div>

      <label className="field-label" htmlFor={`explanation-${draft.id}`}>Explanation <span className="field-optional">(optional)</span></label>
      <textarea
        className="review-explanation"
        id={`explanation-${draft.id}`}
        onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))}
        placeholder="Short context shown behind a disclosure. Not part of the answer."
        value={draft.explanation ?? ''}
      />

      {errors.length > 0 ? <p className="form-error" role="alert">{errors.join(' ')}</p> : null}

      <footer className="review-card-footer">
        {hasSource(draft) ? (
          <button
            aria-controls={sourcePanelId}
            aria-expanded={sourceOpen}
            className="text-button review-source-toggle"
            onClick={() => setSourceOpen((open) => !open)}
            type="button"
          >
            <Icon icon={FileSearchIcon} size={16} />
            {sourceOpen ? 'Hide source' : `Page ${draft.sourcePage} · View source`}
          </button>
        ) : (
          <span className="review-source-none">No source</span>
        )}
        <div className="review-actions">
          <button className="secondary-button" onClick={onDiscard} type="button"><Icon icon={Cancel01Icon} />Discard</button>
          <button className="primary-button" onClick={keep} type="button"><Icon icon={Tick02Icon} />Keep card</button>
        </div>
      </footer>

      {sourceOpen && hasSource(draft) ? (
        <div className="evidence-box" id={sourcePanelId}>
          <span>Source quote · p. {draft.sourcePage}{evidenceSource}</span>
          <textarea aria-label="Source quote" onChange={(event) => setDraft((current) => ({ ...current, sourceQuote: event.target.value }))} value={draft.sourceQuote} />
          <p className="evidence-note">A matching quote proves the passage exists. Check that it supports the answer you marked.</p>
        </div>
      ) : null}
    </article>
  )
}
