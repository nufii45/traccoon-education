import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { pantryRepository } from '../pantries/repository'
import { writeOnboardingState } from '../onboarding/onboardingState'

describe('recorded study history', () => {
  beforeEach(() => {
    writeOnboardingState({ completed: true, mode: 'local-private' })
  })

  it('shows answers recorded on this device when a saved pantry is reopened', async () => {
    const pantry = await pantryRepository.createPantry({
      title: 'Cell respiration',
      sourceName: 'lecture-4.pdf',
      sourcePages: [{ id: 'page-1', pageNumber: 1, text: 'The Krebs cycle takes place in the mitochondrial matrix of the cell.' }],
    })
    await pantryRepository.saveAttempt({ pantryId: pantry.id, cardId: 'card-1', selectedIndex: 0, isCorrect: true })
    await pantryRepository.saveAttempt({ pantryId: pantry.id, cardId: 'card-2', selectedIndex: 2, isCorrect: false })

    render(<App />)
    const [sidebarLink] = await screen.findAllByRole('button', { name: /Cell respiration/ })
    fireEvent.click(sidebarLink)

    expect(await screen.findByText(/Recorded on this device: 1 of 2 answers correct/)).toBeInTheDocument()
  })
})
