import { describe, expect, it } from 'vitest'
import { summarizeAttempts } from './attemptSummary'

const attempt = (id: string, isCorrect: boolean, createdAt: string) => ({
  id,
  pantryId: 'pantry-1',
  cardId: 'card-1',
  selectedIndex: 0,
  isCorrect,
  createdAt,
})

describe('summarizeAttempts', () => {
  it('returns undefined when nothing has been studied', () => {
    expect(summarizeAttempts([])).toBeUndefined()
  })

  it('counts answers, correct answers, and the latest study time', () => {
    expect(
      summarizeAttempts([
        attempt('a1', true, '2026-10-09T10:00:00.000Z'),
        attempt('a2', false, '2026-10-09T12:00:00.000Z'),
        attempt('a3', true, '2026-10-09T11:00:00.000Z'),
      ]),
    ).toEqual({ answered: 3, correct: 2, lastStudiedAt: '2026-10-09T12:00:00.000Z' })
  })
})
