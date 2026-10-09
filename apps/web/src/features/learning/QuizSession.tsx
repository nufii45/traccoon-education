import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { QUIZ_PICKER_PATH, quizPath, pantryPath } from '../../app/navigation'
import { assessAnswerEvidence } from '../local-ai/answerEvidence'
import { PantryNotFound } from '../pantries/PantryNotFound'
import { usePantry } from '../pantries/usePantry'
import { pantryRepository, type CompletedQuizSession, type Pantry, type StoredCard } from '../pantries/repository'
import { StudySession } from '../study/StudySession'
import type { EconomyEvent } from '../treats/engine'
import { IngredientCelebration } from '../treats/IngredientCelebration'
import { IngredientReward } from '../treats/TreatArt'
import type { IngredientId } from '../treats/catalog'
import { selectPracticeCards } from './practiceRound'
import { QuizResults } from './QuizResults'

const createRunId = () =>
  globalThis.crypto?.randomUUID?.() ?? 'quiz-' + Date.now() + '-' + Math.random().toString(36).slice(2)

const quizUrl = (pantryId: string, params: Record<string, string>) =>
  quizPath(pantryId) + '?' + new URLSearchParams(params).toString()

interface QuizRoundProps {
  pantry: Pantry
  cards: StoredCard[]
  sourceSessionId?: string
  onComplete: (sessionId: string) => void
  onBack: () => void
}

/** Each answer uses the existing local reward transaction; completion only reads it. */
function QuizRound({ pantry, cards, sourceSessionId, onComplete, onBack }: QuizRoundProps) {
  const [runId] = useState(createRunId)
  const attemptIds = useRef<string[]>([])
  const [reward, setReward] = useState<EconomyEvent | null>(null)
  const [celebrating, setCelebrating] = useState<IngredientId | null>(null)
  const latestAnswer = useRef(0)

  const recordAnswer = async (selectedIndex: number, cardId: string) => {
    const position = attemptIds.current.length
    if (cards[position]?.id !== cardId) throw new Error('Quiz card order changed while saving.')
    const answer = ++latestAnswer.current
    setReward(null)
    const stored = await pantryRepository.appendQuizAttempt({
      pantryId: pantry.id,
      cardId,
      selectedIndex,
      attemptId: runId + ':' + position,
      sourceSessionId,
    })
    attemptIds.current[position] = stored.attempt.id
    if (answer === latestAnswer.current) {
      setReward(stored.reward)
      if (stored.reward.type === 'quiz_correct') setCelebrating(stored.reward.ingredientId)
    }
  }

  const finishRound = async () => {
    const completed = await pantryRepository.completeQuizSession({
      id: runId,
      pantryId: pantry.id,
      cards,
      attemptIds: attemptIds.current,
    })
    onComplete(completed.id)
  }

  return (
    <>
      <header className="workspace-header studying">
        <div className="eyebrow"><span /> QUIZ · {cards.length} {cards.length === 1 ? 'CARD' : 'CARDS'}</div>
        <h1>{pantry.title}</h1>
      </header>
      <StudySession
        backLabel="Back to Learning Hub"
        cards={cards}
        evidenceFor={(card) => assessAnswerEvidence(card, pantry.sourcePages)}
        feedbackSlot={reward?.type === 'quiz_incorrect' ? <IngredientReward event={reward} /> : null}
        modeLabel="QUIZ MODE"
        onAttempt={(selectedIndex, _isCorrect, cardId) => recordAnswer(selectedIndex, cardId)}
        onBack={onBack}
        onFinish={finishRound}
        sourceName={pantry.sourceName}
        sourcePages={pantry.sourcePages}
      />
      <IngredientCelebration ingredientId={celebrating} onClose={() => setCelebrating(null)} />
    </>
  )
}

interface LoadedSession {
  id: string
  value: CompletedQuizSession | null
  error?: string
}

/** Saved result URLs only read the completed round, so opening them cannot award ingredients. */
export function QuizSession() {
  const { pantryId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { pantry } = usePantry(pantryId)
  const roundCards = useMemo(() => (pantry ? selectPracticeCards(pantry.cards) : []), [pantry])
  const query = new URLSearchParams(location.search)
  const resultId = query.get('result')
  const retryId = query.get('retry')
  const retryScope = query.get('scope')
  const requestedSessionId = resultId ?? retryId
  const [loadedSession, setLoadedSession] = useState<LoadedSession>()
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!requestedSessionId) return
    let active = true
    pantryRepository.loadQuizSession(requestedSessionId).then((value) => {
      if (active) setLoadedSession({ id: requestedSessionId, value: value ?? null })
    }).catch(() => {
      if (active) setLoadedSession({ id: requestedSessionId, value: null, error: 'This saved quiz could not be opened on this device.' })
    })
    return () => { active = false }
  }, [requestedSessionId, reloadCount])

  if (pantry === undefined) return null
  if (pantry === null) return <PantryNotFound />

  if (requestedSessionId && loadedSession?.id !== requestedSessionId) {
    return <section className="workspace" role="status">Opening saved quiz…</section>
  }

  if (requestedSessionId && loadedSession?.id === requestedSessionId && loadedSession.error) {
    return (
      <section className="workspace">
        <p className="form-error" role="alert">{loadedSession.error}</p>
        <button className="primary-button" onClick={() => setReloadCount((value) => value + 1)} type="button">Try again</button>
        <Link className="text-button" to={QUIZ_PICKER_PATH}>Back to Quiz</Link>
      </section>
    )
  }

  const saved = requestedSessionId ? loadedSession?.value : undefined
  if (requestedSessionId && (!saved || saved.pantryId !== pantry.id || (retryId && retryScope !== 'missed' && retryScope !== 'all'))) {
    return (
      <section className="workspace">
        <h1>Quiz result unavailable</h1>
        <p>This round is no longer saved on this device.</p>
        <Link className="secondary-button" to={QUIZ_PICKER_PATH}>Back to Quiz</Link>
      </section>
    )
  }

  if (resultId && saved) {
    return (
      <section className="workspace">
        <QuizResults
          attempts={saved.attempts}
          cards={saved.cards}
          evidenceFor={(card) => assessAnswerEvidence(card, pantry.sourcePages)}
          ingredientIds={saved.awardedIngredients}
          onBack={() => navigate('/learn')}
          onPracticeMissed={() => navigate(quizUrl(pantry.id, { retry: saved.id, scope: 'missed' }))}
          onStudyAll={() => navigate(quizUrl(pantry.id, { retry: saved.id, scope: 'all' }))}
          sourceName={pantry.sourceName}
          sourcePages={pantry.sourcePages}
        />
      </section>
    )
  }

  const cards = retryId && saved
    ? retryScope === 'missed'
      ? saved.cards.filter((_, index) => !saved.attempts[index].isCorrect)
      : saved.cards
    : roundCards

  if (cards.length === 0) {
    return (
      <section className="workspace">
        <h1>{pantry.title}</h1>
        <p className="hero-copy">{retryId ? 'There are no missed cards in this round.' : 'This pantry has no cards to quiz yet.'}</p>
        <Link className="secondary-button" to={retryId ? quizUrl(pantry.id, { result: retryId }) : pantryPath(pantry.id)}>
          {retryId ? 'Back to results' : 'Add cards'}
        </Link>
      </section>
    )
  }

  return (
    <section className="workspace">
      <QuizRound
        cards={cards}
        key={retryId ? retryId + ':' + retryScope : 'new'}
        onBack={() => navigate('/learn')}
        onComplete={(sessionId) => navigate(quizUrl(pantry.id, { result: sessionId }), { replace: true })}
        pantry={pantry}
        sourceSessionId={retryId ?? undefined}
      />
    </section>
  )
}
