import { describe, expect, it } from 'vitest'
import { initialTreatEconomy } from '../treats/engine'
import { TREAT_RECIPES } from '../treats/catalog'
import type { PantrySummary, QuizSessionSummary, StudyAttempt } from '../pantries/repository'
import { summarizeRokkiProgress } from './progress'

const now = Date.parse('2026-10-10T12:00:00.000Z')
const pantry: PantrySummary = {
  id: 'pantry-1', title: 'Biology', sourceName: 'biology.pdf', pageCount: 2, cardCount: 4,
  createdAt: '', updatedAt: '',
}
const attempt: StudyAttempt = {
  id: 'attempt-1', pantryId: pantry.id, cardId: 'card-1', selectedIndex: 0,
  isCorrect: true, createdAt: '2026-10-10T10:00:00.000Z', mode: 'quiz',
}
const quiz: QuizSessionSummary = {
  id: 'quiz-1', completedAt: '2026-10-10T10:01:00.000Z', answered: 1, correct: 1,
}

describe('Rokki progress', () => {
  it('greets a new learner without inventing activity', () => {
    const result = summarizeRokkiProgress([], [], [], initialTreatEconomy(), now)
    expect(result.greeting).toBe("Hi! I'm Rokki. Let's learn something new!")
    expect(result.cardsReviewed).toBe(0)
    expect(result.quizRounds).toBe(0)
  })

  it('counts saved cards, attempts, completed quizzes, and current inventory', () => {
    const economy = { ...initialTreatEconomy(), ingredients: { flour: 2 }, treats: { [TREAT_RECIPES[0].id]: 1 } }
    const result = summarizeRokkiProgress([pantry], [attempt], [quiz], economy, now)
    expect(result).toMatchObject({ cardCount: 4, cardsReviewed: 1, quizRounds: 1, quizCorrect: 1, quizAnswered: 1, ingredients: 2, treats: 1 })
    expect(result.greeting).toBe('Nice work finishing your quiz!')
  })

  it('does not keep a quiz completion greeting after a day or later study', () => {
    expect(summarizeRokkiProgress([pantry], [attempt], [quiz], initialTreatEconomy(), now + 25 * 60 * 60 * 1000).greeting)
      .toBe('Welcome back! Ready for another round?')
    const laterAttempt = { ...attempt, id: 'attempt-2', createdAt: '2026-10-10T11:00:00.000Z', mode: 'practice' as const }
    expect(summarizeRokkiProgress([pantry], [attempt, laterAttempt], [quiz], initialTreatEconomy(), now).greeting)
      .toBe('Welcome back! Ready for another round?')
  })
})
