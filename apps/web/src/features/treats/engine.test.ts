import { describe, expect, it } from 'vitest'
import { INGREDIENTS, TREAT_RECIPES } from './catalog'
import type { IngredientId } from './catalog'
import {
  awardPracticeIA,
  awardQuizIngredient,
  canCraft,
  craftTreat,
  feedTreat,
  initialTreatEconomy,
  localDateKey,
  missingIngredients,
  totalIngredients,
  totalOwnedTreats,
  type TreatEconomy,
} from './engine'

/** A `random` that makes awardQuizIngredient pick this ingredient. */
const pick = (id: IngredientId) => () => (INGREDIENTS.findIndex((item) => item.id === id) + 0.5) / INGREDIENTS.length

const collectRecipe = (state: TreatEconomy, recipe: (typeof TREAT_RECIPES)[number]) =>
  recipe.ingredients.reduce(
    (current, ingredient) => awardQuizIngredient(current, `attempt-${recipe.id}-${ingredient.id}`, true, pick(ingredient.id)).state,
    state,
  )

describe('treat catalog', () => {
  it('has 10 five-ingredient recipes over 25 unique ingredients, all WebP', () => {
    expect(TREAT_RECIPES).toHaveLength(10)
    expect(INGREDIENTS).toHaveLength(25)
    expect(new Set(INGREDIENTS.map((item) => item.id)).size).toBe(25)
    for (const recipe of TREAT_RECIPES) {
      expect(recipe.ingredients).toHaveLength(5)
      expect(recipe.image).toMatch(/\.webp$/)
      for (const ingredient of recipe.ingredients) expect(ingredient.recipeImage).toMatch(/\.webp$/)
    }
  })
})

describe('awardQuizIngredient', () => {
  it('grants exactly one ingredient for a correct answer and replays without granting again', () => {
    const first = awardQuizIngredient(initialTreatEconomy(), 'attempt-a', true, pick('milk'))
    expect(first.event).toEqual({ type: 'quiz_correct', ingredientId: 'milk' })
    expect(totalIngredients(first.state)).toBe(1)

    const replay = awardQuizIngredient(first.state, 'attempt-a', true, pick('egg'))
    expect(replay.duplicate).toBe(true)
    expect(replay.state).toBe(first.state)
    expect(replay.event).toEqual(first.event)
  })

  it('grants nothing for a wrong answer and rejects a conflicting replay', () => {
    const wrong = awardQuizIngredient(initialTreatEconomy(), 'wrong-a', false)
    expect(wrong.event).toEqual({ type: 'quiz_incorrect' })
    expect(totalIngredients(wrong.state)).toBe(0)
    expect(() => awardQuizIngredient(wrong.state, 'wrong-a', true)).toThrow(/Conflicting/)
  })

  it('rejects a missing event ID', () => {
    expect(() => awardQuizIngredient(initialTreatEconomy(), '', true)).toThrow(/stable/)
  })
})

describe('craftTreat', () => {
  it('consumes the recipe ingredients once and adds one treat', () => {
    const recipe = TREAT_RECIPES[0]
    const ready = collectRecipe(initialTreatEconomy(), recipe)
    expect(canCraft(ready, recipe.id)).toBe(true)

    const crafted = craftTreat(ready, 'craft-a', recipe.id)
    expect(crafted.state.treats[recipe.id]).toBe(1)
    expect(totalOwnedTreats(crafted.state)).toBe(1)
    expect(missingIngredients(crafted.state, recipe.id).map((part) => part.missing)).toEqual([1, 1, 1, 1, 1])

    const replay = craftTreat(crafted.state, 'craft-a', recipe.id)
    expect(replay.duplicate).toBe(true)
    expect(replay.state).toBe(crafted.state)
    expect(() => craftTreat(crafted.state, 'craft-a', recipe.id, 2)).toThrow(/Conflicting/)
  })

  it('refuses to craft with missing ingredients', () => {
    expect(canCraft(initialTreatEconomy(), TREAT_RECIPES[0].id)).toBe(false)
    expect(() => craftTreat(initialTreatEconomy(), 'craft-missing', TREAT_RECIPES[0].id)).toThrow(/Missing ingredients/)
  })

  it('debits boost IA once and rejects a boost the balance cannot cover', () => {
    const recipe = TREAT_RECIPES[1]
    const ready = collectRecipe(initialTreatEconomy(), recipe)
    expect(() => craftTreat(ready, 'craft-no-ia', recipe.id, 3)).toThrow(/Not enough/)

    const funded = awardPracticeIA(ready, 'practice-round-a', 30)
    expect(awardPracticeIA(funded.state, 'practice-round-a', 30).state.ia).toBe(30)
    const doubled = craftTreat(funded.state, 'craft-double', recipe.id, 2)
    expect(doubled.state.ia).toBe(10)
    expect(doubled.state.treats[recipe.id]).toBe(2)
  })

  it('can complete every recipe', () => {
    for (const recipe of TREAT_RECIPES) {
      const ready = collectRecipe(initialTreatEconomy(), recipe)
      expect(craftTreat(ready, `craft-${recipe.id}`, recipe.id).state.treats[recipe.id]).toBe(1)
    }
  })
})

describe('feedTreat', () => {
  it('consumes one treat once and never goes negative', () => {
    const recipe = TREAT_RECIPES[0]
    const crafted = craftTreat(collectRecipe(initialTreatEconomy(), recipe), 'craft-a', recipe.id)
    const fed = feedTreat(crafted.state, 'feed-a', recipe.id, '2026-10-10')
    expect(fed.state.treats[recipe.id]).toBe(0)
    expect(feedTreat(fed.state, 'feed-a', recipe.id, '2026-10-10').duplicate).toBe(true)
    expect(() => feedTreat(fed.state, 'feed-b', recipe.id, '2026-10-10')).toThrow(/No treat/)
  })
})

describe('localDateKey', () => {
  it('formats the local calendar date', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
