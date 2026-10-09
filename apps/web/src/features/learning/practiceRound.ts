/** Cards per Practice round (PRD addendum: five-card rounds). */
export const PRACTICE_ROUND_SIZE = 5

/**
 * Number of cards a round will use for a pantry of this size.
 *
 * [ASSUMPTION] A pantry with fewer than five cards gets a shorter round
 * instead of repeats. The addendum leaves this open (§11 decision 5); Practice
 * awards nothing yet, so a short round misrepresents no reward.
 */
export const practiceRoundLength = (cardCount: number) => Math.min(cardCount, PRACTICE_ROUND_SIZE)

/**
 * Draws one round of distinct cards in random order with a partial
 * Fisher–Yates shuffle. Returns a new array; the input is not modified.
 */
export const selectPracticeCards = <T>(cards: readonly T[], random: () => number = Math.random): T[] => {
  const pool = [...cards]
  const length = practiceRoundLength(pool.length)

  for (let index = 0; index < length; index += 1) {
    const swapIndex = index + Math.floor(random() * (pool.length - index))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }

  return pool.slice(0, length)
}
