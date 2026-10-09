/** A small, fixed set of encouraging messages Rokki says on tap/click. */
export const ROKKI_MESSAGES = [
  'Ready to learn?',
  "Let's make something!",
  'You got this!',
  'One step at a time!',
] as const

export type RokkiMessage = (typeof ROKKI_MESSAGES)[number]

/**
 * Pick a message, avoiding an immediate repeat of `previous` so repeated taps
 * feel varied. Deterministic when `random` is supplied, which keeps tests
 * stable.
 */
export function pickMessage(previous?: string, random: () => number = Math.random, messages: readonly string[] = ROKKI_MESSAGES): string {
  const pool = previous
    ? messages.filter((message) => message !== previous)
    : messages
  const choices = pool.length > 0 ? pool : messages
  if (choices.length === 0) return ROKKI_MESSAGES[0]
  const index = Math.min(choices.length - 1, Math.floor(random() * choices.length))
  return choices[index]
}
