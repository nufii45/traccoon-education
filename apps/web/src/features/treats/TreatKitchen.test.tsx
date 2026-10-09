import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { writeOnboardingState } from '../onboarding/onboardingState'
import { pantryRepository } from '../pantries/repository'
import { INGREDIENTS, TREAT_RECIPES } from './catalog'

const recipe = TREAT_RECIPES[0]

/** Answer Quiz cards correctly with draws that land on each of this recipe's ingredients. */
const collectRecipe = async () => {
  const pantry = await pantryRepository.createPantry({ title: 'Treat set', sourceName: 'Written by hand', sourcePages: [] })
  await pantryRepository.saveCards(pantry.id, [{
    id: 'card-1',
    question: 'Question?',
    options: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'],
    correctIndex: 0,
    sourcePage: 0,
    sourceQuote: '',
    sourceChunkId: '',
    generationMode: 'local-private',
    generationMethod: 'manual',
    createdAt: new Date().toISOString(),
  }])
  for (const ingredient of recipe.ingredients) {
    const index = INGREDIENTS.findIndex((item) => item.id === ingredient.id)
    await pantryRepository.appendQuizAttempt({ pantryId: pantry.id, cardId: 'card-1', selectedIndex: 0 }, () => (index + 0.5) / INGREDIENTS.length)
  }
}

describe('Treat Shelf', () => {
  beforeEach(() => {
    localStorage.clear()
    writeOnboardingState({ completed: true, mode: 'local-private' })
    window.history.replaceState(null, '', '/treats')
  })

  it('shows all ten recipes with their art and points an empty shelf to Quiz', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Make something sweet for Rokki.' })).toBeInTheDocument()
    expect(await screen.findAllByRole('article')).toHaveLength(10)
    for (const treat of TREAT_RECIPES) {
      expect(screen.getByRole('img', { name: treat.name })).toHaveAttribute('src', `/assets/treats/${treat.image}`)
    }
    expect(screen.getByRole('link', { name: 'Take a Quiz' })).toHaveAttribute('href', '/learn/quiz')
    expect(screen.queryByText(/IA|boost/i)).toBeNull()
    for (const button of screen.getAllByRole('button', { name: 'Collect ingredients' })) expect(button).toBeDisabled()
  })

  it('makes a treat from collected ingredients and feeds it only on request', async () => {
    await collectRecipe()
    render(<App />)

    const card = await screen.findByRole('article', { name: `${recipe.name} recipe` })
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
    fireEvent.click(within(card).getByRole('button', { name: 'Make treat' }))

    expect(await screen.findByText(`Made a ${recipe.name}. It is on your shelf.`)).toBeInTheDocument()
    expect(within(card).getByText('On shelf ×1')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Collect ingredients' })).toBeDisabled()
    expect((await pantryRepository.loadTreatEconomy()).treats[recipe.id]).toBe(1)

    fireEvent.click(within(card).getByRole('button', { name: 'Feed Rokki' }))
    expect(await screen.findByText(`Rokki enjoyed the ${recipe.name}.`)).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Feed Rokki' })).toBeNull()
    expect((await pantryRepository.loadTreatEconomy()).treats[recipe.id]).toBe(0)
  })

  it('filters to recipes on the shelf', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'On my shelf' }))
    expect(screen.getByRole('button', { name: 'On my shelf' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
  })

  it('keeps the treat name visible when its image fails to load', async () => {
    render(<App />)

    const image = await screen.findByRole('img', { name: recipe.name })
    fireEvent.error(image)

    const fallback = screen.getByRole('img', { name: recipe.name })
    expect(fallback.tagName).toBe('SPAN')
    expect(fallback).toHaveTextContent(recipe.name)
  })
})
