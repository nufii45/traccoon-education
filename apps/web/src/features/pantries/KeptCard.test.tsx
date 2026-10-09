import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeptCard } from './KeptCard'
import type { StoredCard } from './repository'

const card: StoredCard = {
  id: 'card-1',
  pantryId: 'pantry-1',
  question: 'How long do Bitongol seeds take to germinate in a potting medium?',
  options: ['39 days', '15 days', '25 days', '60 days'],
  correctIndex: 0,
  explanation: 'Measured against a moistened paper towel control that took 15 days.',
  sourcePage: 6,
  sourceQuote: 'Bitongol seeds germinate in 39 days in a potting medium.',
  sourceChunkId: 'page-6-chunk-1',
  generationMode: 'local-private',
  generationMethod: 'webllm',
  createdAt: '2026-10-10T00:00:00.000Z',
}

describe('KeptCard', () => {
  it('shows the question and the key answer, hiding the full quote by default', () => {
    render(<KeptCard card={card} />)
    expect(screen.getByText(card.question)).toBeInTheDocument()
    expect(screen.getByText('39 days')).toBeInTheDocument()
    expect(screen.queryByText(/Bitongol seeds germinate in 39 days in a potting medium/)).not.toBeInTheDocument()
  })

  it('reveals the source quote and explanation when View source is opened', () => {
    render(<KeptCard card={card} />)
    fireEvent.click(screen.getByRole('button', { name: /Page 6 · View source/ }))
    expect(screen.getByText(/Bitongol seeds germinate in 39 days in a potting medium/)).toBeInTheDocument()
    expect(screen.getByText(/moistened paper towel control that took 15 days/)).toBeInTheDocument()
  })

  it('describes a hand-written card with no source', () => {
    const manual: StoredCard = {
      ...card,
      explanation: undefined,
      sourceQuote: '',
      sourcePage: 0,
      sourceChunkId: '',
      generationMethod: 'manual',
    }
    render(<KeptCard card={manual} />)
    expect(screen.getByText('No source · written by hand')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /View source/ })).not.toBeInTheDocument()
  })
})
