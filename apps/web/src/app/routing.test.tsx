import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { writeOnboardingState } from '../features/onboarding/onboardingState'
import { pantryRepository } from '../features/pantries/repository'

const createPantryWithCard = async (title: string) => {
  const pantry = await pantryRepository.createPantry({ title, sourceName: 'Written by hand', sourcePages: [] })
  await pantryRepository.saveCards(pantry.id, [{
    id: `${title}-card`,
    question: 'Which organelle runs the Calvin cycle?',
    options: ['Stroma', 'Nucleus', 'Ribosome', 'Vacuole'],
    correctIndex: 0,
    sourcePage: 0,
    sourceQuote: '',
    sourceChunkId: '',
    generationMode: 'local-private',
    generationMethod: 'manual',
    createdAt: new Date().toISOString(),
  }])
  return pantry
}

describe('navigation and URLs', () => {
  beforeEach(() => {
    localStorage.clear()
    writeOnboardingState({ completed: true, mode: 'local-private' })
    window.history.replaceState(null, '', '/')
  })

  it('shows four destinations with My Pantries active and unbuilt ones marked Soon', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(nav).getByRole('link', { name: 'My Pantries' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Learning Hub' })).not.toHaveAttribute('aria-current')
    for (const label of ['Treat Shelf', 'Rokki']) {
      const item = within(nav).getByText(label).closest('.nav-link')
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).toHaveTextContent('Soon')
    }
  })

  it('collapses and expands the nested pantry list', async () => {
    await createPantryWithCard('Collapsible set')
    render(<App />)
    const sidebar = screen.getByRole('complementary', { name: 'Pantries' })
    const toggle = within(sidebar).getByRole('button', { name: 'My Pantries' })

    expect(await within(sidebar).findByRole('button', { name: /Collapsible set/ })).toBeVisible()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(sidebar).queryByRole('button', { name: /Collapsible set/ })).toBeNull()
    fireEvent.click(toggle)
    expect(within(sidebar).getByRole('button', { name: /Collapsible set/ })).toBeVisible()
  })

  it('gives each pantry and its Practice shortcut a real URL with the id, not the title', async () => {
    const pantry = await createPantryWithCard('Routed set')
    render(<App />)

    const sidebar = screen.getByRole('complementary', { name: 'Pantries' })
    fireEvent.click(await within(sidebar).findByRole('button', { name: /Routed set/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Routed set' })).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/pantries/${pantry.id}`)

    fireEvent.click(screen.getByRole('button', { name: 'Study 1 card' }))
    expect(await screen.findByText(/PRACTICE · 1 CARD/)).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/learn/practice/${pantry.id}`)
  })

  it('starts each new screen at the top of the page', async () => {
    await createPantryWithCard('Scrolled set')
    render(<App />)
    document.documentElement.scrollTop = 400

    const sidebar = screen.getByRole('complementary', { name: 'Pantries' })
    fireEvent.click(await within(sidebar).findByRole('button', { name: /Scrolled set/ }))
    await screen.findByRole('heading', { level: 1, name: 'Scrolled set' })

    expect(document.documentElement.scrollTop).toBe(0)
  })

  it('opens a pantry directly from its URL, as after a reload', async () => {
    const pantry = await createPantryWithCard('Deep link set')
    window.history.replaceState(null, '', `/pantries/${pantry.id}`)
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Deep link set' })).toBeInTheDocument()
  })

  it('explains a pantry id that is not stored on this device', async () => {
    window.history.replaceState(null, '', '/pantries/not-a-real-id')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Pantry not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to My Pantries' })).toHaveAttribute('href', '/pantries')
  })

  it('sends unknown paths to My Pantries', async () => {
    window.history.replaceState(null, '', '/nowhere')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /What are we studying/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/pantries')
  })
})
