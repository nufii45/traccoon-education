import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { PRACTICE_PICKER_PATH, pantryPath, type PracticeRouteState } from '../../app/navigation'
import { PantryNotFound } from '../pantries/PantryNotFound'
import { usePantry } from '../pantries/usePantry'
import { pantryRepository } from '../pantries/repository'
import { StudySession } from '../study/StudySession'
import { selectPracticeCards } from './practiceRound'

/**
 * One Practice round for the pantry in the URL. Answers are saved as local
 * attempts. Resuming a round after a reload and Study Power (IA) awards wait
 * on the session and ledger storage in src/data.
 */
export function PracticeSession() {
  const { pantryId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { pantry } = usePantry(pantryId)
  const isFromPantry = (location.state as PracticeRouteState | null)?.from === 'pantry'
  const roundCards = useMemo(() => (pantry ? selectPracticeCards(pantry.cards) : []), [pantry])

  if (pantry === undefined) return null
  if (pantry === null) return <PantryNotFound />

  if (roundCards.length === 0) {
    return (
      <section className="workspace">
        <h1>{pantry.title}</h1>
        <p className="hero-copy">This pantry has no cards to practice yet.</p>
        <Link className="secondary-button" to={pantryPath(pantry.id)}>Add cards</Link>
      </section>
    )
  }

  return (
    <section className="workspace">
      <header className="workspace-header studying">
        <div className="eyebrow"><span /> PRACTICE · {roundCards.length} {roundCards.length === 1 ? 'CARD' : 'CARDS'}</div>
        <h1>{pantry.title}</h1>
      </header>
      <StudySession
        backLabel={isFromPantry ? 'Back to pantry' : 'Back to Learning Hub'}
        cards={roundCards}
        onAttempt={(selectedIndex, isCorrect, cardId) =>
          pantryRepository.saveAttempt({
            pantryId: pantry.id,
            cardId,
            selectedIndex,
            isCorrect,
          })
        }
        onBack={() => navigate(isFromPantry ? pantryPath(pantry.id) : PRACTICE_PICKER_PATH)}
        sourceName={pantry.sourceName}
        sourcePages={pantry.sourcePages}
      />
    </section>
  )
}
