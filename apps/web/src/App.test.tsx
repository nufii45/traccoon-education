import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { writeOnboardingState } from './features/onboarding/onboardingState'

const completeOnboarding = () => writeOnboardingState({ completed: true, mode: 'local-private' })

describe('Traccoon Education', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
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

  it('opens the local-only PDF import workspace from the dashboard', async () => {
    completeOnboarding()
    render(<App />)

    const [createFromPdf] = screen.getAllByRole('button', { name: /Create from a PDF/i })
    fireEvent.click(createFromPdf)

    expect(
      await screen.findByRole('heading', { name: 'Study from your source. Locally.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No upload. No account. No cloud generation in this MVP.')).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a PDF')).toBeInTheDocument()
  })

  it('opens the manual author path without requiring a model or PDF', async () => {
    completeOnboarding()
    render(<App />)

    const [createManually] = screen.getAllByRole('button', { name: /Create manually/i })
    fireEvent.click(createManually)

    expect(await screen.findByRole('heading', { name: 'Build your first card' })).toBeInTheDocument()
  })
})
