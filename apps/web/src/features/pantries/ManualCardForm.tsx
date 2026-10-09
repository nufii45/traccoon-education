import { useState, type FormEvent } from 'react'
import type { GeneratedCard, SourcePage } from '../local-ai/types'
import { buildManualCard, emptyManualDraft, type ManualCardDraft } from './manualCard'

interface ManualCardFormProps {
  onCancel: () => void
  onSave: (card: GeneratedCard) => void
  sourcePages: SourcePage[]
}

const letter = (index: number) => String.fromCharCode(65 + index)

const createCardId = () =>
  globalThis.crypto?.randomUUID?.() ?? `manual-card-${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * Hand-written card. No AI, no PDF required, and no answer is preselected.
 * Citing a passage is optional and only offered when the pantry has pages.
 */
export function ManualCardForm({ onCancel, onSave, sourcePages }: ManualCardFormProps) {
  const [draft, setDraft] = useState<ManualCardDraft>(emptyManualDraft)
  const [errors, setErrors] = useState<string[]>([])

  const update = (changes: Partial<ManualCardDraft>) => setDraft((current) => ({ ...current, ...changes }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = buildManualCard(draft, sourcePages, { id: createCardId(), createdAt: new Date().toISOString() })
    if (!result.card) {
      setErrors(result.errors)
      return
    }
    onSave(result.card)
  }

  return (
    <form className="manual-card-form" onSubmit={submit}>
      <h3>Manual card</h3>
      <label className="field-label" htmlFor="manual-question">Question</label>
      <textarea id="manual-question" onChange={(event) => update({ question: event.target.value })} placeholder="Write a question…" value={draft.question} />
      <fieldset className="manual-options">
        <legend className="field-label">Options · pick the correct one</legend>
        {draft.options.map((option, index) => (
          <label key={`manual-option-${index}`}>
            <input aria-label={`Mark option ${letter(index)} correct`} checked={draft.correctIndex === index} name="manual-correct" onChange={() => update({ correctIndex: index })} type="radio" />
            <span>{letter(index)}</span>
            <input aria-label={`Manual option ${index + 1}`} onChange={(event) => update({ options: draft.options.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)) })} placeholder={`Option ${index + 1}`} value={option} />
          </label>
        ))}
      </fieldset>
      {sourcePages.length > 0 ? (
        <div className="manual-source-fields">
          <label className="field-label" htmlFor="manual-source-page">Cite a page (optional)</label>
          <select id="manual-source-page" onChange={(event) => update({ sourcePage: event.target.value ? Number(event.target.value) : null })} value={draft.sourcePage ?? ''}>
            <option value="">No source</option>
            {sourcePages.map((page) => <option key={page.id} value={page.pageNumber}>Page {page.pageNumber}</option>)}
          </select>
          <label className="field-label" htmlFor="manual-source-quote">Exact quote from that page (optional)</label>
          <textarea id="manual-source-quote" onChange={(event) => update({ sourceQuote: event.target.value })} value={draft.sourceQuote} />
        </div>
      ) : null}
      {errors.length > 0 ? <p className="form-error" role="alert">{errors.join(' ')}</p> : null}
      <div className="review-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" type="submit">Save card</button>
      </div>
    </form>
  )
}
