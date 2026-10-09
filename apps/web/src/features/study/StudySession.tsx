import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft01Icon,
  ArrowRight02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  FileSearchIcon,
  RepeatIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import type { SourcePage } from '../local-ai/types'
import { hasSource } from '../pantries/cardSource'
import type { StoredCard } from '../pantries/repository'
import { SourceView } from './SourceView'
import {
  createStudySession,
  getCurrentCard,
  getCurrentResult,
  getMissedCards,
  getScore,
  studyReducer,
} from './studyReducer'
import styles from './StudySession.module.css'

interface StudySessionProps {
  cards: StoredCard[]
  sourcePages: SourcePage[]
  sourceName: string
  onAttempt: (selectedIndex: number, isCorrect: boolean, cardId: string) => Promise<unknown>
  onBack: () => void
  /** Label for the exit button; Practice from the Learning Hub returns there instead. */
  backLabel?: string
  /** Heading label above the card counter. */
  modeLabel?: string
  /** Shown under the answer feedback, e.g. the Quiz ingredient reward for this answer. */
  feedbackSlot?: ReactNode
  /** Shown on the end screen under the score. */
  summarySlot?: ReactNode
}

const letter = (index: number) => String.fromCharCode(65 + index)

/**
 * One card at a time with immediate feedback, a source view for every card,
 * and an end screen listing missed cards. Attempts are saved locally.
 */
export function StudySession({
  cards,
  sourcePages,
  sourceName,
  onAttempt,
  onBack,
  backLabel = 'Back to pantry',
  modeLabel = 'STUDY MODE',
  feedbackSlot,
  summarySlot,
}: StudySessionProps) {
  const [state, dispatch] = useReducer(studyReducer, cards, createStudySession)
  const [selected, setSelected] = useState<number>()
  const [sourceCard, setSourceCard] = useState<StoredCard>()
  const [saveError, setSaveError] = useState<string>()
  const questionRef = useRef<HTMLHeadingElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const summaryRef = useRef<HTMLHeadingElement>(null)

  const card = getCurrentCard(state)
  const result = getCurrentResult(state)

  // Keep keyboard and screen-reader focus with the flow: the answer controls
  // unmount or disable after checking, so focus would otherwise drop to <body>.
  // Skipped on first render so opening study does not steal focus.
  const hasInteracted = useRef(false)
  useEffect(() => {
    if (!hasInteracted.current) {
      return
    }
    if (state.phase === 'feedback') {
      nextButtonRef.current?.focus()
    } else if (state.phase === 'answering') {
      questionRef.current?.focus()
    } else {
      summaryRef.current?.focus()
    }
  }, [state.phase, state.position])

  const checkAnswer = () => {
    if (selected === undefined || !card) {
      return
    }
    hasInteracted.current = true
    dispatch({ type: 'answer', selectedIndex: selected })
    onAttempt(selected, selected === card.correctIndex, card.id).catch(() => {
      setSaveError('This answer could not be saved on this device. You can keep studying.')
    })
  }

  const continueSession = () => {
    setSelected(undefined)
    setSaveError(undefined)
    dispatch({ type: 'continue' })
  }

  const restart = (nextCards: StoredCard[]) => {
    hasInteracted.current = true
    setSelected(undefined)
    setSaveError(undefined)
    dispatch({ type: 'restart', cards: nextCards })
  }

  const sourceView = (
    <SourceView card={sourceCard} onClose={() => setSourceCard(undefined)} sourceName={sourceName} sourcePages={sourcePages} />
  )

  if (state.phase === 'finished') {
    const missed = getMissedCards(state)
    const score = getScore(state)
    return (
      <section className="study-session" aria-labelledby="study-summary-heading">
        <div className="study-header">
          <div>
            <div className="step-label">SESSION COMPLETE</div>
            <h2 id="study-summary-heading" ref={summaryRef} tabIndex={-1}>{score.correct} of {score.answered} correct</h2>
          </div>
          <button className="secondary-button" onClick={onBack} type="button"><Icon icon={ArrowLeft01Icon} />{backLabel}</button>
        </div>
        {summarySlot}
        {missed.length > 0 ? (
          <div className={styles.missed}>
            <h3 className={styles.missedHeading}>Missed cards</h3>
            <ul className={styles.missedList}>
              {missed.map((missedCard) => (
                <li className={styles.missedItem} key={missedCard.id}>
                  <div>
                    <p className={styles.missedQuestion}>{missedCard.question}</p>
                    <p className={styles.missedAnswer}>
                      Answer: {letter(missedCard.correctIndex)}, {missedCard.options[missedCard.correctIndex]}
                    </p>
                  </div>
                  {hasSource(missedCard) ? (
                    <button className={`text-button ${styles.tapTarget}`} onClick={() => setSourceCard(missedCard)} type="button">
                      <Icon icon={FileSearchIcon} size={16} />See source · p.{missedCard.sourcePage}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.allCorrect}>You got every card right.</p>
        )}
        <div className="study-actions">
          {missed.length > 0 ? (
            <button className={`primary-button ${styles.tapTarget}`} onClick={() => restart(missed)} type="button">
              <Icon icon={RepeatIcon} />Study {missed.length} missed {missed.length === 1 ? 'card' : 'cards'}
            </button>
          ) : null}
          <button className={`secondary-button ${styles.tapTarget}`} onClick={() => restart(cards)} type="button">Study all again</button>
        </div>
        {sourceView}
      </section>
    )
  }

  if (!card) {
    return null
  }

  return (
    <section className="study-session" aria-labelledby="study-card-heading">
      <div className="study-header">
        <div>
          <div className="step-label">{modeLabel}</div>
          <h2 id="study-card-heading">Card {state.position + 1} of {state.cards.length}</h2>
        </div>
        <button className="secondary-button" onClick={onBack} type="button"><Icon icon={ArrowLeft01Icon} />{backLabel}</button>
      </div>
      <div
        aria-label="Session progress"
        aria-valuemax={state.cards.length}
        aria-valuemin={0}
        aria-valuenow={state.results.length}
        className={styles.progress}
        role="progressbar"
      >
        <div className={styles.progressFill} style={{ width: `${(state.results.length / state.cards.length) * 100}%` }} />
      </div>
      {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
      <article className="study-card">
        <p className={styles.cardMeta}>
          {hasSource(card) ? `From page ${card.sourcePage}` : 'No source'} · {card.generationMethod === 'manual' ? 'Manual' : 'On-device'}
          {card.isEdited ? ' · Edited' : ''}
        </p>
        <h3 ref={questionRef} tabIndex={-1}>{card.question}</h3>
        <div className="study-options">
          {card.options.map((option, optionIndex) => {
            const isCorrect = optionIndex === card.correctIndex
            const isPicked = result ? result.selectedIndex === optionIndex : selected === optionIndex
            const className = result
              ? isCorrect ? 'answer correct' : isPicked ? 'answer incorrect' : 'answer'
              : isPicked ? 'answer selected' : 'answer'
            return (
              <button
                aria-pressed={result ? undefined : isPicked}
                className={className}
                disabled={result !== undefined}
                key={`${card.id}-${optionIndex}`}
                onClick={() => setSelected(optionIndex)}
                type="button"
              >
                <span>{letter(optionIndex)}</span>
                {option}
                {result && isCorrect ? <em className={styles.answerTag}><Icon icon={Tick02Icon} size={16} />Correct answer</em> : null}
                {result && isPicked && !isCorrect ? <em className={styles.answerTag}><Icon icon={Cancel01Icon} size={16} />Your answer</em> : null}
              </button>
            )
          })}
        </div>
        <div aria-live="polite" className={styles.feedbackRegion}>
          {result ? (
            <div className={result.isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}>
              <p className={styles.feedbackTitle}>
                <Icon icon={result.isCorrect ? CheckmarkCircle02Icon : CancelCircleIcon} size={24} />
                {result.isCorrect ? 'Correct.' : 'Not quite.'}
              </p>
              {result.isCorrect ? null : (
                <p>The answer is {letter(card.correctIndex)}, {card.options[card.correctIndex]}.</p>
              )}
            </div>
          ) : null}
        </div>
        {result ? feedbackSlot : null}
        <div className="study-actions">
          {result ? (
            <>
              {hasSource(card) ? (
                <button className={`secondary-button ${styles.tapTarget}`} onClick={() => setSourceCard(card)} type="button">
                  <Icon icon={FileSearchIcon} />See source · p.{card.sourcePage}
                </button>
              ) : null}
              <button className={`primary-button ${styles.tapTarget}`} onClick={continueSession} ref={nextButtonRef} type="button">
                {state.position + 1 === state.cards.length ? 'See results' : 'Next card'} <Icon icon={ArrowRight02Icon} />
              </button>
            </>
          ) : (
            <button className={`primary-button ${styles.tapTarget}`} disabled={selected === undefined} onClick={checkAnswer} type="button">
              Check answer
            </button>
          )}
        </div>
      </article>
      {sourceView}
    </section>
  )
}
