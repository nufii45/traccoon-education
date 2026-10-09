import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingFlow } from './OnboardingFlow'

describe('OnboardingFlow', () => {
  it('walks through all four teaching screens and finishes with the chosen mode', () => {
    const onComplete = vi.fn()
    render(<OnboardingFlow onComplete={onComplete} />)

    // 1. Welcome
    expect(screen.getByRole('heading', { name: /Study what actually matters/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))

    // 2. How it works
    expect(screen.getByRole('heading', { name: /Three steps from PDF to practice/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))

    // 3. Offline first
    expect(screen.getByRole('heading', { name: /Generate online\. Study offline/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))

    // 4. Getting started
    expect(screen.getByRole('heading', { name: /Pick how Rokki generates cards/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Go to my dashboard/i }))

    expect(onComplete).toHaveBeenCalledWith('local-private')
  })

  it('lets the learner go back to a previous screen', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^Back/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Back/i }))

    expect(screen.getByRole('heading', { name: /Study what actually matters/i })).toBeInTheDocument()
  })

  it('can skip the intro immediately', () => {
    const onComplete = vi.fn()
    render(<OnboardingFlow onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip intro' }))

    expect(onComplete).toHaveBeenCalledWith('local-private')
  })

  it('uses the matching Rokki illustration on every teaching screen', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)

    expect(screen.getByRole('img', { name: 'Rokki welcomes you to Traccoon Education' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-welcome.webp'),
    )

    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    expect(screen.getByRole('img', { name: 'Rokki selecting useful PDF pages' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-pages.webp'),
    )
    expect(screen.getByRole('img', { name: 'Rokki reviewing study cards' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-cards.webp'),
    )
    expect(screen.getByRole('img', { name: 'Rokki choosing a study path' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-choice.webp'),
    )

    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    expect(screen.getByRole('img', { name: 'Rokki studying offline with a tablet' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-offline.webp'),
    )

    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    expect(screen.getByRole('img', { name: 'Rokki ready to help you choose a study mode' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-choice.webp'),
    )
  })

  it('records a cloud-enhanced preference without simulating sign-in', () => {
    const onComplete = vi.fn()
    const onModeChange = vi.fn()
    render(<OnboardingFlow onComplete={onComplete} onModeChange={onModeChange} />)

    // Advance to the Getting started screen.
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))

    fireEvent.click(screen.getByRole('radio', { name: /Cloud Enhanced/i }))
    expect(onModeChange).toHaveBeenCalledWith('cloud-enhanced')

    // The cloud sign-in affordance is present but disabled — no fake auth.
    expect(screen.getByRole('button', { name: /Sign in to cloud/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Go to my dashboard/i }))
    expect(onComplete).toHaveBeenCalledWith('cloud-enhanced')
  })

  it('recommends local-private as the default selection', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }))

    expect(screen.getByRole('radio', { name: /Local Private/i })).toBeChecked()
  })
})
