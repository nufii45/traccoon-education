import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LocalAiStatus } from '../local-ai/localAiClient'
import { GenerationExperience } from './GenerationExperience'
import { deriveGenerationView } from './generationStages'

const viewFor = (status: LocalAiStatus, hasCards = false) => deriveGenerationView(status, hasCards)

describe('GenerationExperience', () => {
  it('shows the Rokki heading, dynamic status, and stage counter while generating', () => {
    render(
      <GenerationExperience
        status={{ stage: 'generating', detail: 'Generating', attempt: 1 }}
        view={viewFor({ stage: 'generating', detail: 'Generating', attempt: 1 })}
      />,
    )

    expect(screen.getByText('Rokki is making your cards!')).toBeInTheDocument()
    expect(screen.getByText('Creating your study questions…')).toBeInTheDocument()
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument()
    // The mascot is present but silent; the status line is the live region.
    expect(screen.getByText('This may take a moment on your device.')).toBeInTheDocument()
  })

  it('reports the model download as determinate progress on the mascot ring', () => {
    render(
      <GenerationExperience
        status={{ stage: 'downloading', detail: 'Fetching', progress: 42 }}
        view={viewFor({ stage: 'downloading', detail: 'Fetching', progress: 42 })}
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByText('Reading your selected pages…')).toBeInTheDocument()
  })

  it('shows the success message with no indeterminate progressbar once cards are ready', () => {
    render(
      <GenerationExperience
        status={{ stage: 'ready', detail: 'done' }}
        view={viewFor({ stage: 'ready', detail: 'done' }, true)}
      />,
    )

    expect(screen.getByText('Your study cards are ready!')).toBeInTheDocument()
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
    expect(screen.queryByText('This may take a moment on your device.')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
