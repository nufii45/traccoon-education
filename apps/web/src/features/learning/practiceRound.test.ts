import { describe, expect, it } from 'vitest'
import { PRACTICE_ROUND_SIZE, practiceRoundLength, selectPracticeCards } from './practiceRound'

const cards = Array.from({ length: 12 }, (_, index) => ({ id: `card-${index}` }))

describe('selectPracticeCards', () => {
  it('draws at most one round of distinct cards', () => {
    const round = selectPracticeCards(cards)

    expect(round).toHaveLength(PRACTICE_ROUND_SIZE)
    expect(new Set(round.map((card) => card.id)).size).toBe(PRACTICE_ROUND_SIZE)
    round.forEach((card) => expect(cards).toContain(card))
  })

  it('uses every card when the pantry has fewer than a full round', () => {
    const small = cards.slice(0, 3)

    expect(selectPracticeCards(small).map((card) => card.id).sort()).toEqual(['card-0', 'card-1', 'card-2'])
  })

  it('shuffles with the injected random source and leaves the input untouched', () => {
    const before = cards.map((card) => card.id)
    const alwaysLast = () => 0.999

    const round = selectPracticeCards(cards, alwaysLast)

    expect(round.map((card) => card.id)).toEqual(['card-11', 'card-0', 'card-1', 'card-2', 'card-3'])
    expect(cards.map((card) => card.id)).toEqual(before)
  })

  it('returns an empty round for an empty pantry', () => {
    expect(selectPracticeCards([])).toEqual([])
  })
})

describe('practiceRoundLength', () => {
  it('caps the round at the round size', () => {
    expect(practiceRoundLength(0)).toBe(0)
    expect(practiceRoundLength(3)).toBe(3)
    expect(practiceRoundLength(12)).toBe(PRACTICE_ROUND_SIZE)
  })
})
