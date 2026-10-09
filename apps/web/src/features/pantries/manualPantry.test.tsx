import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../App'

describe('manual pantry', () => {
  it('has no fake source page and hides generation', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start a manual pantry' }))
    fireEvent.click(await screen.findByRole('button', { name: /Create manual pantry/ }))

    expect(await screen.findByText('Written by hand · no PDF')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Generate up to/ })).toBeNull()
    expect(screen.queryByText(/Add a source quote to ground/)).toBeNull()
  })
})
