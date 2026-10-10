import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GeneratedCard, SourcePage } from '../local-ai/types'
import { ReviewCard } from './ReviewCard'

const pages: SourcePage[] = [
  { id: 'page-12', pageNumber: 12, text: 'The Krebs cycle takes place in the mitochondrial matrix, where acetyl-CoA is oxidized.' },
]
const suggestion: GeneratedCard = {
  id: 'webllm-chunk-12-1',
  question: 'Where does the Krebs cycle take place?',
  options: ['Cytoplasm', 'Mitochondrial matrix', 'Nucleus', 'Ribosome'],
  correctIndex: 1,
  sourcePage: 12,
  sourceQuote: 'The Krebs cycle takes place in the mitochondrial matrix',
  sourceChunkId: 'chunk-12',
  generationMode: 'local-private',
  generationMethod: 'webllm',
  createdAt: '2026-10-09T10:00:00.000Z',
}

const renderCard = () => {
  const onKeep = vi.fn()
  const onDiscard = vi.fn()
  render(<ReviewCard card={suggestion} onDiscard={onDiscard} onKeep={onKeep} sourcePages={pages} />)
  return { onKeep, onDiscard }
}

describe('ReviewCard', () => {
  it('keeps an untouched suggestion without marking it edited', () => {
    const { onKeep } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Keep card' }))
    expect(onKeep).toHaveBeenCalledWith(expect.objectContaining({ id: suggestion.id, isEdited: false }))
  })

  it('marks a changed suggestion as edited', () => {
    const { onKeep } = renderCard()
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Cytosol' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep card' }))
    expect(onKeep).toHaveBeenCalledWith(expect.objectContaining({ isEdited: true, options: expect.arrayContaining(['Cytosol']) }))
  })

  it('blocks a quote edited so it no longer matches the page', () => {
    const { onKeep } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /View source/ }))
    fireEvent.change(screen.getByLabelText('Source quote'), {
      target: { value: 'Glycolysis splits glucose into pyruvate inside the cytoplasm of every cell' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Keep card' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Source quote is not present on the cited page.')
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('keeps the full source quote behind the View source disclosure', () => {
    renderCard()
    expect(screen.queryByLabelText('Source quote')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Page 12 · View source/ }))
    expect(screen.getByLabelText('Source quote')).toBeInTheDocument()
  })

  it('blocks duplicate options', () => {
    const { onKeep } = renderCard()
    fireEvent.change(screen.getByLabelText('Option 3'), { target: { value: 'Cytoplasm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep card' }))
    expect(screen.getByRole('alert')).toHaveTextContent('four distinct')
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('discards a suggestion', () => {
    const { onDiscard } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalled()
  })
})
