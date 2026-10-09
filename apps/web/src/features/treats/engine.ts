import { INGREDIENTS, TREAT_RECIPES, treatById } from './catalog'
import type { IngredientId, TreatId } from './catalog'

/**
 * Pure treat economy. Every command is idempotent by a stable event ID: a
 * replay returns the recorded event instead of granting or spending again.
 * Events hold catalog IDs only, never learner study content.
 */

/** IA cost of each crafting multiplier. ×1 is always free; boosts stay hidden until an IA ledger ships. */
export const BOOST_COST = { 1: 0, 2: 20, 3: 45 } as const
export type Multiplier = 1 | 2 | 3

export type EconomyEvent =
  | { type: 'quiz_correct'; ingredientId: IngredientId }
  | { type: 'quiz_incorrect' }
  | { type: 'practice_ia'; amount: number }
  | { type: 'crafted'; treatId: TreatId; multiplier: Multiplier; iaSpent: number }
  | { type: 'fed'; treatId: TreatId; date: string }

export interface TreatEconomy {
  version: 1
  ingredients: Partial<Record<IngredientId, number>>
  treats: Partial<Record<TreatId, number>>
  ia: number
  events: Record<string, EconomyEvent>
}

export interface Update {
  state: TreatEconomy
  event: EconomyEvent
  duplicate: boolean
}

export interface RecipePart {
  id: IngredientId
  required: number
  owned: number
  missing: number
  recipeImage: string
}

export const initialTreatEconomy = (): TreatEconomy => ({
  version: 1,
  ingredients: {},
  treats: {},
  ia: 0,
  events: {},
})

const assertEventId = (value: string): void => {
  if (typeof value !== 'string' || value.length < 3 || value.length > 200) {
    throw new Error('A stable, nonempty event ID is required.')
  }
}

const previous = (state: TreatEconomy, key: string): Update | null =>
  Object.hasOwn(state.events, key) ? { state, event: state.events[key], duplicate: true } : null

const append = (state: TreatEconomy, key: string, event: EconomyEvent, delta: Partial<TreatEconomy>): Update => ({
  state: { ...state, ...delta, events: { ...state.events, [key]: event } },
  event,
  duplicate: false,
})

/** Record a Quiz answer. A correct one grants exactly one uniformly random ingredient; a wrong one grants nothing. */
export function awardQuizIngredient(
  state: TreatEconomy,
  attemptId: string,
  correct: boolean,
  random: () => number = Math.random,
): Update {
  assertEventId(attemptId)
  const key = `quiz:${attemptId}`
  const replay = previous(state, key)
  if (replay) {
    if ((replay.event.type === 'quiz_correct') !== correct) throw new Error('Conflicting replay of a Quiz attempt.')
    return replay
  }
  if (!correct) return append(state, key, { type: 'quiz_incorrect' }, {})
  const index = Math.floor(random() * INGREDIENTS.length)
  if (!Number.isInteger(index) || index < 0 || index >= INGREDIENTS.length) {
    throw new Error('Random ingredient index out of range.')
  }
  const ingredientId = INGREDIENTS[index].id
  return append(state, key, { type: 'quiz_correct', ingredientId }, {
    ingredients: { ...state.ingredients, [ingredientId]: (state.ingredients[ingredientId] ?? 0) + 1 },
  })
}

/** For a future verified Practice payout: call once per eligible session, never per question. */
export function awardPracticeIA(state: TreatEconomy, sessionId: string, amount: number): Update {
  assertEventId(sessionId)
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100) throw new Error('Invalid IA award.')
  const key = `practice:${sessionId}`
  const replay = previous(state, key)
  if (replay) {
    if (replay.event.type !== 'practice_ia' || replay.event.amount !== amount) throw new Error('Conflicting Practice payout replay.')
    return replay
  }
  return append(state, key, { type: 'practice_ia', amount }, { ia: state.ia + amount })
}

export function missingIngredients(state: TreatEconomy, treatId: TreatId): RecipePart[] {
  const recipe = treatById[treatId]
  if (!recipe) throw new Error(`Unknown treat: ${treatId}`)
  return recipe.ingredients.map((item) => {
    const owned = state.ingredients[item.id] ?? 0
    return { id: item.id, required: item.quantity, owned, missing: Math.max(0, item.quantity - owned), recipeImage: item.recipeImage }
  })
}

export const canCraft = (state: TreatEconomy, treatId: TreatId, multiplier: Multiplier = 1): boolean =>
  missingIngredients(state, treatId).every((item) => item.missing === 0) && state.ia >= BOOST_COST[multiplier]

/** Spend one set of recipe ingredients (and any boost IA) to add `multiplier` treats. */
export function craftTreat(state: TreatEconomy, craftId: string, treatId: TreatId, multiplier: Multiplier = 1): Update {
  assertEventId(craftId)
  const key = `craft:${craftId}`
  const replay = previous(state, key)
  if (replay) {
    if (replay.event.type !== 'crafted' || replay.event.treatId !== treatId || replay.event.multiplier !== multiplier) {
      throw new Error('Conflicting craft action replay.')
    }
    return replay
  }
  if (![1, 2, 3].includes(multiplier)) throw new Error('Unsupported multiplier.')
  const parts = missingIngredients(state, treatId)
  if (parts.some((item) => item.missing > 0)) throw new Error('Missing ingredients for this recipe.')
  const iaSpent = BOOST_COST[multiplier]
  if (state.ia < iaSpent) throw new Error('Not enough Intellectual Ability for this boost.')
  const ingredients = { ...state.ingredients }
  for (const part of parts) ingredients[part.id] = (ingredients[part.id] ?? 0) - part.required
  return append(state, key, { type: 'crafted', treatId, multiplier, iaSpent }, {
    ingredients,
    treats: { ...state.treats, [treatId]: (state.treats[treatId] ?? 0) + multiplier },
    ia: state.ia - iaSpent,
  })
}

/** Consume one crafted treat. Only call for an explicit learner Feed action; never auto-feed. */
export function feedTreat(state: TreatEconomy, feedId: string, treatId: TreatId, date: string): Update {
  assertEventId(feedId)
  const key = `feed:${feedId}`
  const replay = previous(state, key)
  if (replay) {
    if (replay.event.type !== 'fed' || replay.event.treatId !== treatId) throw new Error('Conflicting feed action replay.')
    return replay
  }
  if (!treatById[treatId]) throw new Error('Unknown treat.')
  if ((state.treats[treatId] ?? 0) < 1) throw new Error('No treat available to feed.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Expected YYYY-MM-DD feed date.')
  return append(state, key, { type: 'fed', treatId, date }, {
    treats: { ...state.treats, [treatId]: (state.treats[treatId] ?? 0) - 1 },
  })
}

export const countFeedsOn = (state: TreatEconomy, date: string): number =>
  Object.values(state.events).filter((event) => event.type === 'fed' && event.date === date).length

export const totalOwnedTreats = (state: TreatEconomy): number =>
  TREAT_RECIPES.reduce((sum, recipe) => sum + (state.treats[recipe.id] ?? 0), 0)

export const totalIngredients = (state: TreatEconomy): number =>
  Object.values(state.ingredients).reduce((sum, count) => sum + (count ?? 0), 0)

/** Local calendar date as YYYY-MM-DD, for feed events. */
export const localDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
