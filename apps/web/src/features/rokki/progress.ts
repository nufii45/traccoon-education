import type { PantrySummary, QuizSessionSummary, StudyAttempt } from '../pantries/repository'
import type { TreatEconomy } from '../treats/engine'
import { totalIngredients, totalOwnedTreats } from '../treats/engine'

export interface RokkiProgress {
  pantryCount: number
  cardCount: number
  cardsReviewed: number
  quizRounds: number
  quizCorrect: number
  quizAnswered: number
  ingredients: number
  treats: number
  greeting: string
}

const RECENT_QUIZ_MS = 24 * 60 * 60 * 1000

/** Use only saved learning and inventory records; a started Quiz is not a completed round. */
export function summarizeRokkiProgress(
  pantries: PantrySummary[],
  attempts: StudyAttempt[],
  quizzes: QuizSessionSummary[],
  economy: TreatEconomy,
  now = Date.now(),
): RokkiProgress {
  const ingredients = totalIngredients(economy)
  const treats = totalOwnedTreats(economy)
  const latestQuiz = quizzes.reduce<QuizSessionSummary | undefined>(
    (latest, quiz) => !latest || quiz.completedAt > latest.completedAt ? quiz : latest,
    undefined,
  )
  const latestAttempt = attempts.reduce(
    (latest, attempt) => attempt.createdAt > latest ? attempt.createdAt : latest,
    '',
  )
  const completedAt = latestQuiz ? Date.parse(latestQuiz.completedAt) : NaN
  const justFinishedQuiz = Number.isFinite(completedAt)
    && now >= completedAt
    && now - completedAt < RECENT_QUIZ_MS
    && (latestQuiz?.completedAt ?? '') >= latestAttempt

  const greeting = justFinishedQuiz
    ? 'Nice work finishing your quiz!'
    : ingredients > 0
      ? "You've collected some ingredients! Want to make a treat?"
      : pantries.length === 0 && attempts.length === 0
        ? "Hi! I'm Rokki. Let's learn something new!"
        : 'Welcome back! Ready for another round?'

  return {
    pantryCount: pantries.length,
    cardCount: pantries.reduce((total, pantry) => total + pantry.cardCount, 0),
    cardsReviewed: attempts.length,
    quizRounds: quizzes.length,
    quizCorrect: quizzes.reduce((total, quiz) => total + quiz.correct, 0),
    quizAnswered: quizzes.reduce((total, quiz) => total + quiz.answered, 0),
    ingredients,
    treats,
    greeting,
  }
}
