import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { writeOnboardingState } from '../onboarding/onboardingState'
import { pantryRepository } from '../pantries/repository'

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

  it('offers Practice and marks Quiz as not available yet', async () => {
    window.history.replaceState(null, '', '/learn')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Pick how you want to study.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Practice/ })).toHaveAttribute('href', '/learn/practice')
    const quiz = screen.getByText('Quiz').closest('[aria-disabled]')
    expect(quiz).toHaveAttribute('aria-disabled', 'true')
    expect(quiz).toHaveTextContent('Soon')
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
