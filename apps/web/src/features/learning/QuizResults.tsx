import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { TREATS_PATH } from '../../app/navigation'
import type { StoredCard, StudyAttempt } from '../../data/pantryRepository'
import type { SourcePage } from '../local-ai/types'
import { ingredientById } from '../treats/catalog'
import type { IngredientId } from '../treats/catalog'
import { IngredientIcon } from '../treats/TreatArt'
import { InteractiveRokki } from '../../components/InteractiveRokki'
import { SourceView } from '../study/SourceView'
import styles from './QuizResults.module.css'

export interface QuizResultsProps {
  cards: StoredCard[]
  attempts: StudyAttempt[]
  ingredientIds: IngredientId[]
  sourcePages: SourcePage[]
  sourceName: string
  evidenceFor: (card: StoredCard) => { status: 'source-linked' | 'needs-review' }
  onPracticeMissed: () => void
  onStudyAll: () => void
  onBack: () => void
}

const INITIAL_MISSED_COUNT = 3

export function QuizResults({
  cards,
  attempts,
  ingredientIds,
  sourcePages,
  sourceName,
  evidenceFor,
  onPracticeMissed,
  onStudyAll,
  onBack,
}: QuizResultsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [showAllMissed, setShowAllMissed] = useState(false)
  const [sourceCard, setSourceCard] = useState<StoredCard>()
  const correctCount = attempts.filter((attempt) => attempt.isCorrect).length
  const totalCount = attempts.length
  const missed = cards.flatMap((card, index) => attempts[index]?.isCorrect === false ? [{ card, number: index + 1 }] : [])
  const visibleMissed = showAllMissed ? missed : missed.slice(0, INITIAL_MISSED_COUNT)
  const hasPerfectScore = totalCount > 0 && correctCount === totalCount

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const encouragement = hasPerfectScore
    ? { title: 'Nice work!', detail: 'Rokki is cheering you on.' }
    : correctCount === 0
      ? { title: 'You showed up and tried.', detail: "Let's practice together, one card at a time." }
      : { title: "You're making progress!", detail: 'Each answer helps you see what to study next.' }

  return (
    <section aria-labelledby="quiz-results-heading" className={styles.results}>
      <header className={styles.hero}>
        <InteractiveRokki
          className={styles.rokki}
          imageAlt=""
          interactive={false}
          src="/assets/rokki/rokki-classic.svg"
          state={hasPerfectScore ? 'celebrating' : 'idle'}
          width={112}
        />
        <p className={styles.eyebrow}>Quiz complete</p>
        <h1 id="quiz-results-heading" ref={headingRef} tabIndex={-1}>Session complete!</h1>
        <p className={styles.encouragement}>{encouragement.title}</p>
        <p className={styles.score}>{correctCount} out of {totalCount} correct</p>
        <p className={styles.support}>{encouragement.detail}</p>
        <ol aria-label="Question results" className={styles.segments}>
          {attempts.map((attempt, index) => (
            <li
              aria-label={`Question ${index + 1}: ${attempt.isCorrect ? 'correct' : 'needs practice'}`}
              className={attempt.isCorrect ? styles.segmentCorrect : styles.segmentMissed}
              key={attempt.id}
              title={`Question ${index + 1}: ${attempt.isCorrect ? 'correct' : 'needs practice'}`}
            />
          ))}
        </ol>
      </header>

      <section aria-labelledby="quiz-rewards-heading" className={styles.rewards}>
        <div className={styles.rewardHeader}>
          <div>
            <h2 id="quiz-rewards-heading">Rewards earned</h2>
            <p>{ingredientIds.length === 0
              ? 'No ingredients collected this round.'
              : `${ingredientIds.length} ${ingredientIds.length === 1 ? 'ingredient' : 'ingredients'} collected`}</p>
          </div>
          <Link className="text-button" to={TREATS_PATH}>Visit Treat Shelf <span aria-hidden="true">→</span></Link>
        </div>
        {ingredientIds.length > 0 ? (
          <ul aria-label="Ingredients collected" className={styles.ingredients}>
            {ingredientIds.map((id, index) => (
              <li className={styles.ingredient} key={`${id}-${index}`}>
                <IngredientIcon id={id} loading="eager" size={48} />
                <span aria-hidden="true">{ingredientById[id].name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="quiz-missed-heading" className={styles.review}>
        <div className={styles.reviewHeader}>
          <h2 id="quiz-missed-heading">{missed.length === 0 ? 'All caught up' : "Let's practice these again"}</h2>
          <span className={styles.reviewCount}>{missed.length} to review</span>
        </div>
        {missed.length === 0 ? (
          <p className={styles.allCorrect}>You got every card right.</p>
        ) : (
          <>
            <ol className={styles.missedList}>
              {visibleMissed.map(({ card, number }) => {
                const citedPage = sourcePages.find((page) => page.pageNumber === card.sourcePage)
                const hasSavedQuote = card.sourceQuote.trim().length > 0
                const needsReview = evidenceFor(card).status === 'needs-review' || !citedPage || !hasSavedQuote
                const savedAnswer = card.options[card.correctIndex]
                return (
                  <li className={styles.missedCard} key={card.id}>
                    <div className={styles.cardMeta}>
                      <span>Question {String(number).padStart(2, '0')}</span>
                      <span>{card.sourcePage > 0 ? `Page ${card.sourcePage}` : 'No source page'}</span>
                    </div>
                    <h3>{card.question}</h3>
                    {needsReview ? <p className={styles.reviewNotice}>Needs review</p> : null}
                    <div className={styles.answer}>
                      <span>{needsReview ? 'Saved answer to check' : 'Answer on this card'}</span>
                      <strong>{savedAnswer ?? 'Answer unavailable'}</strong>
                    </div>
                    {needsReview ? (
                      <p className={styles.caution}>Check the saved answer against the source before relying on it.</p>
                    ) : null}
                    {hasSavedQuote ? (
                      <details className={styles.quote}>
                        <summary>{card.sourcePage > 0 ? `Page ${card.sourcePage} · View saved quote` : 'View saved quote'}</summary>
                        <blockquote>{card.sourceQuote}</blockquote>
                        <p>A matching passage alone does not confirm the answer.</p>
                      </details>
                    ) : null}
                    {citedPage ? (
                      <button className={`text-button ${styles.sourceButton}`} onClick={() => setSourceCard(card)} type="button">
                        Open source page {card.sourcePage}
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ol>
            {missed.length > INITIAL_MISSED_COUNT ? (
              <button className={`text-button ${styles.showMore}`} onClick={() => setShowAllMissed((current) => !current)} type="button">
                {showAllMissed ? 'Show fewer' : `Show ${missed.length - INITIAL_MISSED_COUNT} more`}
              </button>
            ) : null}
          </>
        )}
      </section>

      <div className={styles.actions}>
        {missed.length > 0 ? (
          <button className="primary-button" onClick={onPracticeMissed} type="button">
            Practice {missed.length} missed {missed.length === 1 ? 'card' : 'cards'}
          </button>
        ) : (
          <button className="primary-button" onClick={onBack} type="button">Back to Learning Hub</button>
        )}
        <button className="secondary-button" onClick={onStudyAll} type="button">Study all again</button>
        {missed.length > 0 ? <button className="text-button" onClick={onBack} type="button">Back to Learning Hub</button> : null}
      </div>
      <SourceView card={sourceCard} onClose={() => setSourceCard(undefined)} sourceName={sourceName} sourcePages={sourcePages} />
    </section>
  )
}
