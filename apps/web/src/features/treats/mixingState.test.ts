import { describe, expect, it } from 'vitest'
import { TREAT_RECIPES } from './catalog'
import {
  MIX_DISTANCE_TARGET,
  createMixingState,
  isMixed,
  isReady,
  mixingReducer,
  requiredIngredients,
  stirAmountFromDistance,
  type MixingState,
} from './mixingState'

const recipe = TREAT_RECIPES[0]
const ids = requiredIngredients(recipe.id)

const fresh = (): MixingState => createMixingState(recipe.id)

const placeAll = (state: MixingState): MixingState =>
  ids.reduce((acc, id) => mixingReducer(acc, { type: 'place', ingredientId: id }), state)

describe('mixingState', () => {
  it('starts idle with the recipe ingredients required and nothing placed', () => {
    const state = fresh()
    expect(state.phase).toBe('idle')
    expect(state.placed).toEqual([])
    expect(state.required).toEqual(ids)
    expect(state.progress).toBe(0)
  })

  it('moves idle -> selecting -> ready as ingredients are placed', () => {
    let state = mixingReducer(fresh(), { type: 'place', ingredientId: ids[0] })
    expect(state.phase).toBe('selecting')
    expect(isReady(state)).toBe(false)

    state = placeAll(state)
    expect(state.phase).toBe('ready')
    expect(isReady(state)).toBe(true)
    expect(state.placed).toHaveLength(ids.length)
  })

  it('ignores ingredients outside the recipe and duplicate placements', () => {
    let state = mixingReducer(fresh(), { type: 'place', ingredientId: 'matcha_powder' })
    expect(state.placed).toEqual([])

    state = mixingReducer(fresh(), { type: 'place', ingredientId: ids[0] })
    const again = mixingReducer(state, { type: 'place', ingredientId: ids[0] })
    expect(again.placed).toEqual([ids[0]])
  })

  it('removes a placed ingredient and falls back to idle when empty', () => {
    let state = mixingReducer(fresh(), { type: 'place', ingredientId: ids[0] })
    state = mixingReducer(state, { type: 'remove', ingredientId: ids[0] })
    expect(state.placed).toEqual([])
    expect(state.phase).toBe('idle')
  })

  it('placeAll fills the bowl in one step', () => {
    const state = mixingReducer(fresh(), { type: 'placeAll' })
    expect(state.phase).toBe('ready')
    expect(state.placed).toEqual(ids)
  })

  it('only starts mixing from ready', () => {
    const notReady = mixingReducer(fresh(), { type: 'startMixing' })
    expect(notReady.phase).toBe('idle')

    const mixing = mixingReducer(placeAll(fresh()), { type: 'startMixing' })
    expect(mixing.phase).toBe('mixing')
    expect(mixing.progress).toBe(0)
  })

  it('advances progress only while mixing and clamps at 1', () => {
    const ready = placeAll(fresh())
    const beforeMix = mixingReducer(ready, { type: 'stir', amount: 0.5 })
    expect(beforeMix.progress).toBe(0)

    let state = mixingReducer(ready, { type: 'startMixing' })
    state = mixingReducer(state, { type: 'stir', amount: 0.4 })
    expect(state.progress).toBeCloseTo(0.4)
    state = mixingReducer(state, { type: 'stir', amount: 5 })
    expect(state.progress).toBe(1)
    expect(isMixed(state)).toBe(true)
  })

  it('cannot remove or place once mixing has started', () => {
    let state = mixingReducer(placeAll(fresh()), { type: 'startMixing' })
    state = mixingReducer(state, { type: 'remove', ingredientId: ids[0] })
    expect(state.placed).toHaveLength(ids.length)
    state = mixingReducer(state, { type: 'place', ingredientId: ids[0] })
    expect(state.placed).toHaveLength(ids.length)
  })

  it('only begins crafting from a fully mixed bowl, never twice', () => {
    let state = mixingReducer(placeAll(fresh()), { type: 'startMixing' })
    const halfway = mixingReducer(state, { type: 'stir', amount: 0.5 })
    expect(mixingReducer(halfway, { type: 'beginCrafting' }).phase).toBe('mixing')

    state = mixingReducer(halfway, { type: 'stir', amount: 1 })
    state = mixingReducer(state, { type: 'beginCrafting' })
    expect(state.phase).toBe('crafting')
    // A second beginCrafting cannot re-enter from crafting.
    expect(mixingReducer(state, { type: 'beginCrafting' }).phase).toBe('crafting')
  })

  it('runs the success path crafting -> revealing -> completed', () => {
    let state = mixingReducer(placeAll(fresh()), { type: 'startMixing' })
    state = mixingReducer(state, { type: 'stir', amount: 1 })
    state = mixingReducer(state, { type: 'beginCrafting' })
    state = mixingReducer(state, { type: 'craftSucceeded' })
    expect(state.phase).toBe('revealing')
    state = mixingReducer(state, { type: 'complete' })
    expect(state.phase).toBe('completed')
  })

  it('runs the failure path crafting -> failed with a message', () => {
    let state = mixingReducer(placeAll(fresh()), { type: 'startMixing' })
    state = mixingReducer(state, { type: 'stir', amount: 1 })
    state = mixingReducer(state, { type: 'beginCrafting' })
    state = mixingReducer(state, { type: 'craftFailed', error: 'nope' })
    expect(state.phase).toBe('failed')
    expect(state.error).toBe('nope')
  })

  it('maps pointer distance to a stir amount', () => {
    expect(stirAmountFromDistance(MIX_DISTANCE_TARGET)).toBe(1)
    expect(stirAmountFromDistance(MIX_DISTANCE_TARGET / 2)).toBeCloseTo(0.5)
    expect(stirAmountFromDistance(0)).toBe(0)
    expect(stirAmountFromDistance(-10)).toBe(0)
  })
})
