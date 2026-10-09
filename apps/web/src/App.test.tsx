import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { writeOnboardingState } from './features/onboarding/onboardingState'
import { pantryRepository } from './features/pantries/repository'

const completeOnboarding = () => writeOnboardingState({ completed: true, mode: 'local-private' })

describe('Traccoon Education', () => {
  beforeEach(() => {
    localStorage.clear()
    // Real URLs persist across tests in one file; start each test at the root.
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows the Rokki onboarding welcome screen on first visit', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /Study what actually matters/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip intro' })).toBeInTheDocument()
  })

  it('lands on the home dashboard once onboarding is complete', async () => {
    completeOnboarding()
    render(<App />)

    expect(await screen.findByRole('heading', { name: /What are we studying/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Create from a PDF/i }).length).toBeGreaterThan(0)
  })

  it('returns to the illustrated onboarding flow when replaying the intro', async () => {
    completeOnboarding()
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Replay intro' }))

    expect(
      await screen.findByRole('heading', { name: /Study what actually matters/i }),
    ).toBeInTheDocument()
  })

  it('opens the file picker straight from the dashboard and keeps the import view as a fallback', async () => {
    const pickerClick = vi.spyOn(HTMLInputElement.prototype, 'click')
    completeOnboarding()
    render(<App />)

    const [createFromPdf] = screen.getAllByRole('button', { name: /Create from a PDF/i })
    fireEvent.click(createFromPdf)

    expect(await screen.findByRole('heading', { name: 'Import a PDF' })).toBeInTheDocument()
    expect(screen.getByText('No upload. No account. No cloud generation in this MVP.')).toBeInTheDocument()
    const fileInput = screen.getByLabelText('Choose a PDF')
    expect(pickerClick.mock.contexts).toEqual([fileInput])
  })

  it('does not open the file picker for manual authoring', async () => {
    const pickerClick = vi.spyOn(HTMLInputElement.prototype, 'click')
    completeOnboarding()
    render(<App />)

    const [createManually] = screen.getAllByRole('button', { name: /Create manually/i })
    fireEvent.click(createManually)

    await screen.findByRole('heading', { name: 'Build your first card' })
    expect(pickerClick).not.toHaveBeenCalled()
  })

  it('hides the pantry actions while studying and restores them on the way back', async () => {
    const pantry = await pantryRepository.createPantry({ title: 'Focus set', sourceName: 'Written by hand', sourcePages: [] })
    await pantryRepository.saveCards(pantry.id, [{
      id: 'focus-card',
      question: 'Where do the light dependent reactions happen?',
      options: ['Thylakoid membranes', 'Stroma', 'Cytoplasm', 'Mitochondria'],
      correctIndex: 0,
      sourcePage: 0,
      sourceQuote: '',
      sourceChunkId: '',
      generationMode: 'local-private',
      generationMethod: 'manual',
      createdAt: new Date().toISOString(),
    }])
    completeOnboarding()
    render(<App />)

    const sidebar = screen.getByRole('complementary', { name: 'Pantries' })
    fireEvent.click(await within(sidebar).findByRole('button', { name: /Focus set/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Study 1 card' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Focus set' })).toBeInTheDocument()
    expect(screen.getByText('STUDYING')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete pantry' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Study 1 card' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Back to pantry' }))

    expect(await screen.findByRole('button', { name: 'Delete pantry' })).toBeInTheDocument()
  })

  it('opens the manual author path without requiring a model or PDF', async () => {
    completeOnboarding()
    render(<App />)

    const [createManually] = screen.getAllByRole('button', { name: /Create manually/i })
    fireEvent.click(createManually)

    expect(await screen.findByRole('heading', { name: 'Build your first card' })).toBeInTheDocument()
  })
})
