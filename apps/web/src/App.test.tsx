import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Traccoon Education', () => {
  it('starts with a local-only source import workspace', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Study from your source. Locally.' })).toBeInTheDocument()
    expect(screen.getByText('No upload. No account. No cloud generation in this MVP.')).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a PDF')).toBeInTheDocument()
  })

  it('opens the manual author path without requiring a model or PDF', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Start a manual pantry' }))

    expect(await screen.findByRole('heading', { name: 'Build your first card' })).toBeInTheDocument()
  })
})
