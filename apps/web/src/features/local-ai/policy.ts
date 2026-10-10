export const MAX_SELECTED_PAGES = 3
export const MAX_CARDS_PER_RUN = 3
export const MIN_NORMALIZED_QUOTE_CHARS = 32
export const MAX_REGENERATION_RETRIES = 2

// Concise-card targets. Questions are capped so a student can read one in a
// few seconds; the floor keeps enough context to be unambiguous. Answers stay
// short but may run longer when correctness requires it, so only an upper
// bound is enforced as a hard reject.
export const MIN_QUESTION_WORDS = 4
export const MAX_QUESTION_WORDS = 24
export const PREFERRED_MAX_QUESTION_WORDS = 18
export const MAX_ANSWER_WORDS = 16

// Two cards in one batch whose questions overlap at or above this Jaccard
// score on their significant words are treated as the same question, so only
// the first survives de-duplication.
export const DUPLICATE_QUESTION_SIMILARITY = 0.6
