import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { QUIZ_PICKER_PATH, TREATS_PATH, pantryPath } from '../../app/navigation'
import { PantryNotFound } from '../pantries/PantryNotFound'
import { usePantry } from '../pantries/usePantry'
import { pantryRepository } from '../pantries/repository'
import { StudySession } from '../study/StudySession'
import type { IngredientId } from '../treats/catalog'
import type { EconomyEvent } from '../treats/engine'
import { IngredientIcon, IngredientReward } from '../treats/TreatArt'
import { selectPracticeCards } from './practiceRound'
import styles from './QuizSession.module.css'

/**
 * One Quiz round for the pantry in the URL. Each answer is saved with its
 * ingredient reward in one local transaction; the feedback shows the reward
 * that was actually stored, so a failed save shows no ingredient.
 */
export function QuizSession() {
  const { pantryId = '' } = useParams()
  const navigate = useNavigate()
  const { pantry } = usePantry(pantryId)
  const roundCards = useMemo(() => (pantry ? selectPracticeCards(pantry.cards) : []), [pantry])
  const [reward, setReward] = useState<EconomyEvent | null>(null)
  const [found, setFound] = useState<IngredientId[]>([])
  const latestAnswer = useRef(0)

  if (pantry === undefined) return null
  if (pantry === null) return <PantryNotFound />

  if (roundCards.length === 0) {
    return (
      <section className="workspace">
        <h1>{pantry.title}</h1>
        <p className="hero-copy">This pantry has no cards to quiz yet.</p>
        <Link className="secondary-button" to={pantryPath(pantry.id)}>Add cards</Link>
      </section>
    )
  }

  const recordAnswer = async (selectedIndex: number, cardId: string) => {
    const answer = ++latestAnswer.current
    setReward(null)
    const { reward: stored } = await pantryRepository.appendQuizAttempt({ pantryId: pantry.id, cardId, selectedIndex })
    if (stored.type === 'quiz_correct') {
      setFound((current) => [...current, stored.ingredientId])
    }
    // A slow save must not show its reward under a later card.
    if (answer === latestAnswer.current) {
      setReward(stored)
    }
  }

  const summary = (
    <div className={styles.found}>
      <h3 className={styles.foundHeading}>
        {found.length === 0 ? 'No ingredients found this time.' : `${found.length} ${found.length === 1 ? 'ingredient' : 'ingredients'} found`}
      </h3>
      {found.length > 0 ? (
        <ul className={styles.foundList}>
          {found.map((id, index) => <li key={`${id}-${index}`}><IngredientIcon id={id} size={48} /></li>)}
        </ul>
      ) : null}
      <Link className="text-button" to={TREATS_PATH}>Open the Treat Shelf</Link>
    </div>
  )

  return (
    <section className="workspace">
      <header className="workspace-header studying">
        <div className="eyebrow"><span /> QUIZ · {roundCards.length} {roundCards.length === 1 ? 'CARD' : 'CARDS'}</div>
        <h1>{pantry.title}</h1>
      </header>
      <StudySession
        backLabel="Back to Learning Hub"
        cards={roundCards}
        feedbackSlot={<IngredientReward event={reward} />}
        modeLabel="QUIZ MODE"
        onAttempt={(selectedIndex, _isCorrect, cardId) => recordAnswer(selectedIndex, cardId)}
        onBack={() => navigate(QUIZ_PICKER_PATH)}
        sourceName={pantry.sourceName}
        sourcePages={pantry.sourcePages}
        summarySlot={summary}
      />
    </section>
  )
}
