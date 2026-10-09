import { treatById } from './catalog'
import type { IngredientId, TreatId } from './catalog'

/**
 * Pure state machine for the interactive mixing experience. It owns only the
 * presentation flow (which ingredients are in the bowl, how far the stir has
 * progressed, which phase we are in). It never spends ingredients or writes
 * to the repository: the real craft is committed by the caller once this
 * machine reports a completed mix, so the animation stays a presentation
 * layer around the existing idempotent `craftTreat`.
 */

/** Mixing phases. Invalid transitions are rejected by the reducer. */
export type MixPhase =
  | 'idle'
  | 'selecting'
  | 'ready'
  | 'mixing'
  | 'crafting'
  | 'revealing'
  | 'completed'
  | 'failed'

export interface MixingState {
  treatId: TreatId
  /** Recipe ingredient ids placed into the bowl so far (one slot per required ingredient). */
  placed: IngredientId[]
  /** The full set of ingredient ids this recipe needs, in order. */
  required: IngredientId[]
  phase: MixPhase
  /** 0..1 interactive stir progress. Only advances while phase === 'mixing'. */
  progress: number
  error?: string
}

export type MixingAction =
  | { type: 'place'; ingredientId: IngredientId }
  | { type: 'remove'; ingredientId: IngredientId }
  | { type: 'placeAll' }
  | { type: 'startMixing' }
  | { type: 'stir'; amount: number }
  | { type: 'beginCrafting' }
  | { type: 'craftSucceeded' }
  | { type: 'craftFailed'; error: string }
  | { type: 'reveal' }
  | { type: 'complete' }
  | { type: 'reset'; treatId: TreatId }

/** Pointer distance (in px) required to fully mix. Chosen so a few relaxed circles finish it. */
export const MIX_DISTANCE_TARGET = 1400

/** Each accessible press-hold / keyboard tick contributes this fraction of a full mix. */
export const MIX_HOLD_STEP = 1 / 24

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value)

export const requiredIngredients = (treatId: TreatId): IngredientId[] => {
  const recipe = treatById[treatId]
  if (!recipe) throw new Error(`Unknown treat: ${treatId}`)
  return recipe.ingredients.map((part) => part.id)
}

export const createMixingState = (treatId: TreatId): MixingState => ({
  treatId,
  placed: [],
  required: requiredIngredients(treatId),
  phase: 'idle',
  progress: 0,
})

/** All recipe ingredients are in the bowl. */
export const isReady = (state: MixingState): boolean =>
  state.required.length > 0 && state.required.every((id) => state.placed.includes(id))

/** True once interactive mixing has reached the finish line. */
export const isMixed = (state: MixingState): boolean => state.progress >= 1 - 1e-6

const settlePhaseAfterPlacement = (state: MixingState): MixPhase => {
  if (isReady(state)) return 'ready'
  if (state.placed.length > 0) return 'selecting'
  return 'idle'
}

/**
 * Pure reducer. Rejects transitions that would let a learner mix an
 * incomplete bowl, stir before mixing starts, or start a second craft while
 * one is finalizing. Unknown transitions return the current state unchanged.
 */
export function mixingReducer(state: MixingState, action: MixingAction): MixingState {
  switch (action.type) {
    case 'place': {
      // Only recipe ingredients belong in the bowl, and each slot fills once.
      if (!state.required.includes(action.ingredientId)) return state
      if (state.placed.includes(action.ingredientId)) return state
      if (state.phase !== 'idle' && state.phase !== 'selecting' && state.phase !== 'ready') return state
      const placed = [...state.placed, action.ingredientId]
      const next = { ...state, placed }
      return { ...next, phase: settlePhaseAfterPlacement(next) }
    }
    case 'remove': {
      // Ingredients can only be pulled back out before mixing begins.
      if (state.phase !== 'selecting' && state.phase !== 'ready') return state
      const placed = state.placed.filter((id) => id !== action.ingredientId)
      if (placed.length === state.placed.length) return state
      const next = { ...state, placed }
      return { ...next, phase: settlePhaseAfterPlacement(next) }
    }
    case 'placeAll': {
      if (state.phase !== 'idle' && state.phase !== 'selecting' && state.phase !== 'ready') return state
      const next = { ...state, placed: [...state.required] }
      return { ...next, phase: settlePhaseAfterPlacement(next) }
    }
    case 'startMixing': {
      if (state.phase !== 'ready') return state
      return { ...state, phase: 'mixing', progress: 0 }
    }
    case 'stir': {
      if (state.phase !== 'mixing') return state
      if (!(action.amount > 0)) return state
      return { ...state, progress: clamp01(state.progress + action.amount) }
    }
    case 'beginCrafting': {
      // Only a fully mixed bowl may start crafting, and never twice.
      if (state.phase !== 'mixing') return state
      if (!isMixed(state)) return state
      return { ...state, phase: 'crafting' }
    }
    case 'craftSucceeded': {
      if (state.phase !== 'crafting') return state
      return { ...state, phase: 'revealing' }
    }
    case 'craftFailed': {
      if (state.phase !== 'crafting') return state
      return { ...state, phase: 'failed', error: action.error }
    }
    case 'reveal': {
      // Idempotent: a re-fired reveal while already revealing/completed is a no-op.
      if (state.phase !== 'revealing') return state
      return state
    }
    case 'complete': {
      if (state.phase !== 'revealing') return state
      return { ...state, phase: 'completed' }
    }
    case 'reset': {
      // Re-seed the machine for a freshly opened bowl.
      return createMixingState(action.treatId)
    }
    default:
      return state
  }
}

/**
 * Convert a raw pointer move distance into a stir amount (fraction of a full
 * mix). Interaction, not a timer, drives progress.
 */
export const stirAmountFromDistance = (distance: number): number =>
  distance > 0 ? distance / MIX_DISTANCE_TARGET : 0
