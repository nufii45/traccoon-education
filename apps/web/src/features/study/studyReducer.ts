import type { StoredCard } from '../pantries/repository'

export type StudyPhase = 'answering' | 'feedback' | 'finished'

export interface StudyResult {
  cardId: string
  selectedIndex: number
  isCorrect: boolean
}

export interface StudyState {
  cards: StoredCard[]
  position: number
  phase: StudyPhase
  results: StudyResult[]
}

export type StudyAction =
  | { type: 'answer'; selectedIndex: number }
  | { type: 'continue' }
  | { type: 'restart'; cards: StoredCard[] }

/**
 * Starts a session at the first card, or finished when there are no cards.
 */
export const createStudySession = (cards: StoredCard[]): StudyState => ({
  cards,
  position: 0,
  phase: cards.length === 0 ? 'finished' : 'answering',
  results: [],
})

/**
 * One card at a time: answer, then feedback, then continue. The session ends
 * after the last card instead of wrapping. An answer outside the answering
 * phase is ignored, which absorbs double clicks.
 */
export const studyReducer = (state: StudyState, action: StudyAction): StudyState => {
  switch (action.type) {
    case 'answer': {
      const card = getCurrentCard(state)
      if (state.phase !== 'answering' || !card) {
        return state
      }
      const result: StudyResult = {
        cardId: card.id,
        selectedIndex: action.selectedIndex,
        isCorrect: action.selectedIndex === card.correctIndex,
      }
      return { ...state, phase: 'feedback', results: [...state.results, result] }
    }

    case 'continue': {
      if (state.phase !== 'feedback') {
        return state
      }
      const position = state.position + 1
      return { ...state, position, phase: position >= state.cards.length ? 'finished' : 'answering' }
    }

    case 'restart':
      return createStudySession(action.cards)
  }
}

export const getCurrentCard = (state: StudyState): StoredCard | undefined =>
  state.phase === 'finished' ? undefined : state.cards[state.position]

export const getCurrentResult = (state: StudyState): StudyResult | undefined =>
  state.phase === 'feedback' ? state.results.at(-1) : undefined

/**
 * Scraps are simply the cards missed in this session, in study order.
 */
export const getMissedCards = (state: StudyState): StoredCard[] => {
  const missedIds = new Set(state.results.filter((result) => !result.isCorrect).map((result) => result.cardId))
  return state.cards.filter((card) => missedIds.has(card.id))
}

export const getScore = (state: StudyState) => ({
  correct: state.results.filter((result) => result.isCorrect).length,
  answered: state.results.length,
})
