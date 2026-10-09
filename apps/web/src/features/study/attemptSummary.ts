import type { StudyAttempt } from '../pantries/repository'

export interface AttemptSummary {
  answered: number
  correct: number
  lastStudiedAt: string
}

/**
 * Summarises the attempts stored on this device for one pantry, so the
 * learner can see their recorded study after a reload.
 */
export const summarizeAttempts = (attempts: StudyAttempt[]): AttemptSummary | undefined => {
  if (attempts.length === 0) {
    return undefined
  }
  return {
    answered: attempts.length,
    correct: attempts.filter((attempt) => attempt.isCorrect).length,
    lastStudiedAt: attempts.reduce((latest, attempt) => (attempt.createdAt > latest ? attempt.createdAt : latest), attempts[0].createdAt),
  }
}
