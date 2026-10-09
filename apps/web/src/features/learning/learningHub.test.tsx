import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { writeOnboardingState } from '../onboarding/onboardingState'
import { pantryRepository } from '../pantries/repository'
import { ingredientById } from '../treats/catalog'
import { totalIngredients } from '../treats/engine'

// jsdom has no HTMLDialogElement.showModal; stub the open/close behaviour.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const manualCard = (id: string) => ({
  id,
  question: `Question ${id}?`,
  options: ['Right answer', 'Wrong one', 'Wrong two', 'Wrong three'],
  correctIndex: 0,
  sourcePage: 0,
  sourceQuote: '',
  sourceChunkId: '',
  generationMode: 'local-private' as const,
  generationMethod: 'manual' as const,
  createdAt: new Date().toISOString(),
})

const createPantry = async (title: string, cardCount: number) => {
  const pantry = await pantryRepository.createPantry({ title, sourceName: 'Written by hand', sourcePages: [] })
  await pantryRepository.saveCards(pantry.id, Array.from({ length: cardCount }, (_, index) => manualCard(`${title}-${index}`)))
  return pantry
}

describe('Learning Hub practice', () => {
  beforeEach(() => {
    localStorage.clear()
    writeOnboardingState({ completed: true, mode: 'local-private' })
    window.history.replaceState(null, '', '/')
  })

  it('offers Practice and Quiz', async () => {
    window.history.replaceState(null, '', '/learn')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Pick how you want to study.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Practice/ })).toHaveAttribute('href', '/learn/practice')
    expect(screen.getByRole('link', { name: /Quiz/ })).toHaveAttribute('href', '/learn/quiz')
  })

  it('runs a five-card round from a larger pantry and returns to the Learning Hub', async () => {
    const pantry = await createPantry('Big set', 8)
    window.history.replaceState(null, '', '/learn/practice')
    render(<App />)

    const row = (await screen.findByText('Big set')).closest('li') as HTMLElement
    expect(row).toHaveTextContent('8 cards · round of 5')
    fireEvent.click(within(row).getByRole('link', { name: 'Practice Big set' }))

    expect(await screen.findByText(/PRACTICE · 5 CARDS/)).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/learn/practice/${pantry.id}`)
    expect(screen.getByText('Card 1 of 5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Learning Hub' }))
    expect(await screen.findByRole('heading', { name: 'Choose a pantry.' })).toBeInTheDocument()
  })

  it('points pantries without cards back to authoring instead of starting a round', async () => {
    const pantry = await createPantry('Empty set', 0)
    window.history.replaceState(null, '', '/learn/practice')
    render(<App />)

    const row = (await screen.findByText('Empty set')).closest('li') as HTMLElement
    expect(within(row).queryByRole('link', { name: /Practice/ })).toBeNull()
    expect(within(row).getByRole('link', { name: 'Add cards' })).toHaveAttribute('href', `/pantries/${pantry.id}`)
  })

  it('labels the pantry shortcut with the round size when a pantry has more than five cards', async () => {
    const pantry = await createPantry('Long set', 12)
    window.history.replaceState(null, '', `/pantries/${pantry.id}`)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Study 5 of 12 cards' }))

    expect(await screen.findByRole('button', { name: 'Back to pantry' })).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/learn/practice/${pantry.id}`)
  })
})

describe('Learning Hub quiz', () => {
  beforeEach(() => {
    localStorage.clear()
    writeOnboardingState({ completed: true, mode: 'local-private' })
    window.history.replaceState(null, '', '/')
  })

  const answer = async (option: string) => {
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(option) }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  }

  it('starts a Quiz round from the picker', async () => {
    const pantry = await createPantry('Quiz set', 3)
    window.history.replaceState(null, '', '/learn/quiz')
    render(<App />)

    const row = (await screen.findByText('Quiz set')).closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('link', { name: 'Quiz Quiz set' }))

    expect(await screen.findByText(/QUIZ · 3 CARDS/)).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/learn/quiz/${pantry.id}`)
  })

  it('shows the stored ingredient after a correct answer and saves it with the attempt', async () => {
    const pantry = await createPantry('Correct set', 1)
    const before = totalIngredients(await pantryRepository.loadTreatEconomy())
    window.history.replaceState(null, '', `/learn/quiz/${pantry.id}`)
    render(<App />)

    await answer('Right answer')

    const popup = await screen.findByRole('dialog', { name: /^You found .+!$/ })
    const economy = await pantryRepository.loadTreatEconomy()
    expect(totalIngredients(economy)).toBe(before + 1)
    const [attempt] = await pantryRepository.listAttempts(pantry.id)
    expect(attempt).toMatchObject({ isCorrect: true, mode: 'quiz' })
    const stored = economy.events[`quiz:${attempt.id}`]
    if (stored.type !== 'quiz_correct') throw new Error('Expected a stored ingredient')
    const name = ingredientById[stored.ingredientId].name
    expect(popup).toHaveAccessibleName(`You found ${name}!`)
    expect(within(popup).getByRole('img', { name })).toBeInTheDocument()

    fireEvent.click(within(popup).getByRole('button', { name: 'Keep going' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /See results/ })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /See results/ }))
    expect(await screen.findByRole('heading', { name: '1 ingredient found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the Treat Shelf' })).toHaveAttribute('href', '/treats')
  })

  it('finds no ingredient for a wrong answer', async () => {
    const pantry = await createPantry('Wrong set', 1)
    const before = totalIngredients(await pantryRepository.loadTreatEconomy())
    window.history.replaceState(null, '', `/learn/quiz/${pantry.id}`)
    render(<App />)

    await answer('Wrong one')

    expect(await screen.findByText(/No ingredient this time/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(totalIngredients(await pantryRepository.loadTreatEconomy())).toBe(before)
  })
})
