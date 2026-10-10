import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pantryRepository } from '../pantries/repository'
import { TREAT_RECIPES } from '../treats/catalog'
import { initialTreatEconomy } from '../treats/engine'
import { RokkiCorner } from './RokkiCorner'

afterEach(() => vi.restoreAllMocks())

describe('Rokki Corner', () => {
  it('shows saved progress, a real treat preview, and working destination links', async () => {
    const recipe = TREAT_RECIPES[0]
    vi.spyOn(pantryRepository, 'listPantries').mockResolvedValue([{
      id: 'pantry-1', title: 'Biology', sourceName: 'biology.pdf', pageCount: 2, cardCount: 4,
      createdAt: '', updatedAt: '',
    }])
    vi.spyOn(pantryRepository, 'listAttempts').mockResolvedValue([{
      id: 'attempt-1', pantryId: 'pantry-1', cardId: 'card-1', selectedIndex: 0,
      isCorrect: true, createdAt: '2026-10-10T10:00:00.000Z', mode: 'quiz',
    }])
    vi.spyOn(pantryRepository, 'listQuizSessionSummaries').mockResolvedValue([{
      id: 'quiz-1', completedAt: '2026-10-10T10:01:00.000Z', answered: 1, correct: 1,
    }])
    vi.spyOn(pantryRepository, 'loadTreatEconomy').mockResolvedValue({
      ...initialTreatEconomy(), ingredients: { flour: 2 }, treats: { [recipe.id]: 1 },
    })

    render(<MemoryRouter><RokkiCorner /></MemoryRouter>)
    expect(await screen.findByText('4', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('1 treat is waiting on your shelf.')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Treats on your shelf' })).toHaveTextContent(recipe.name)
    expect(screen.getByRole('link', { name: /Make study cards/i })).toHaveAttribute('href', '/pantries/import')
    expect(screen.getByRole('link', { name: /Practice a quiz/i })).toHaveAttribute('href', '/learn/quiz')
    expect(screen.getByRole('link', { name: /Open Treat Shelf/i })).toHaveAttribute('href', '/treats')
  })

  it('keeps shortcuts usable and offers a retry if local data cannot be read', async () => {
    const list = vi.spyOn(pantryRepository, 'listPantries').mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValue([])
    vi.spyOn(pantryRepository, 'listQuizSessionSummaries').mockResolvedValue([])
    vi.spyOn(pantryRepository, 'loadTreatEconomy').mockResolvedValue(initialTreatEconomy())
    render(<MemoryRouter><RokkiCorner /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be opened')
    expect(screen.getByRole('link', { name: /Explore treats/i })).toHaveAttribute('href', '/treats')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Your learning adventure starts here!')).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })
})
