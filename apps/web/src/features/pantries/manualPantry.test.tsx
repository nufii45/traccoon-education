import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { writeOnboardingState } from '../onboarding/onboardingState'

describe('manual pantry', () => {
  beforeEach(() => {
    writeOnboardingState({ completed: true, mode: 'local-private' })
    window.history.replaceState(null, '', '/')
  })

  it('has no fake source page and hides generation', async () => {
    render(<App />)
    const [createManually] = await screen.findAllByRole('button', { name: /Create manually/i })
    fireEvent.click(createManually)
    fireEvent.click(await screen.findByRole('button', { name: /Create manual pantry/ }))

    expect(await screen.findByText('Written by hand · no PDF')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Generate up to/ })).toBeNull()
    expect(screen.queryByText(/Add a source quote to ground/)).toBeNull()
  })
})
