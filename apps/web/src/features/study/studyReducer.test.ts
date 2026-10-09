import { describe, expect, it } from 'vitest'
import { createStudySession, getCurrentCard, getCurrentResult, getMissedCards, getScore, studyReducer } from './studyReducer'
import { TEST_CARDS } from './testCards'

describe('studyReducer', () => {
  it('starts on the first card with no result', () => {
    const state = createStudySession(TEST_CARDS)
    expect(state.phase).toBe('answering')
    expect(getCurrentCard(state)?.id).toBe('card-1')
    expect(getCurrentResult(state)).toBeUndefined()
  })

  it('gives feedback for correct and incorrect answers', () => {
    const correct = studyReducer(createStudySession(TEST_CARDS), { type: 'answer', selectedIndex: 0 })
    expect(getCurrentResult(correct)).toEqual({ cardId: 'card-1', selectedIndex: 0, isCorrect: true })

    const wrong = studyReducer(createStudySession(TEST_CARDS), { type: 'answer', selectedIndex: 3 })
    expect(getCurrentResult(wrong)?.isCorrect).toBe(false)
  })

  it('ignores a second answer on the same card', () => {
    const answered = studyReducer(createStudySession(TEST_CARDS), { type: 'answer', selectedIndex: 3 })
    expect(studyReducer(answered, { type: 'answer', selectedIndex: 0 })).toBe(answered)
  })

  it('ends after the last card instead of wrapping, and lists missed cards', () => {
    let state = createStudySession(TEST_CARDS)
    for (const selectedIndex of [0, 0]) {
      state = studyReducer(state, { type: 'answer', selectedIndex })
      state = studyReducer(state, { type: 'continue' })
    }
    expect(state.phase).toBe('finished')
    expect(getCurrentCard(state)).toBeUndefined()
    expect(getScore(state)).toEqual({ correct: 1, answered: 2 })
    expect(getMissedCards(state).map((card) => card.id)).toEqual(['card-2'])
  })

  it('restarts with only the cards passed in', () => {
    const state = studyReducer(createStudySession(TEST_CARDS), { type: 'restart', cards: TEST_CARDS.slice(1) })
    expect(state).toMatchObject({ position: 0, phase: 'answering', results: [] })
    expect(state.cards).toHaveLength(1)
  })

  it('treats an empty deck as finished', () => {
    expect(createStudySession([]).phase).toBe('finished')
  })
})
