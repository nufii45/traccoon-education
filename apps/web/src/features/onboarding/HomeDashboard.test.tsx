import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomeDashboard } from './HomeDashboard'
import type { PantrySummary } from '../pantries/repository'

const noop = () => {}

const samplePantry: PantrySummary = {
  id: 'p1',
  title: 'Cell biology',
  sourceName: 'biology.pdf',
  pageCount: 2,
  cardCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('HomeDashboard', () => {
  it('shows the empty-pantry state with both creation paths', () => {
    render(
      <HomeDashboard
        mode="local-private"
        onCreateFromPdf={noop}
        onCreateManually={noop}
        onOpenPantry={noop}
        onReplayIntro={noop}
        pantries={[]}
      />,
    )

    expect(screen.getByRole('heading', { name: /Your pantry is empty/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Create from a PDF/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Create manually/i }).length).toBeGreaterThan(0)
  })

  it('uses contextual Rokki artwork in the hero and empty-pantry state', () => {
    render(
      <HomeDashboard
        mode="local-private"
        onCreateFromPdf={noop}
        onCreateManually={noop}
        onOpenPantry={noop}
        onReplayIntro={noop}
        pantries={[]}
      />,
    )

    expect(screen.getByRole('img', { name: 'Rokki welcomes you back' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-welcome.webp'),
    )
    expect(screen.getByRole('img', { name: 'Rokki is ready to help choose a study path' })).toHaveAttribute(
      'src',
      expect.stringContaining('rokki-choice.webp'),
    )
  })

  it('routes the PDF and manual actions to existing workflows', () => {
    const onCreateFromPdf = vi.fn()
    const onCreateManually = vi.fn()
    render(
      <HomeDashboard
        mode="local-private"
        onCreateFromPdf={onCreateFromPdf}
        onCreateManually={onCreateManually}
        onOpenPantry={noop}
        onReplayIntro={noop}
        pantries={[]}
      />,
    )

    const [pdf] = screen.getAllByRole('button', { name: /Create from a PDF/i })
    const [manual] = screen.getAllByRole('button', { name: /Create manually/i })
    fireEvent.click(pdf)
    fireEvent.click(manual)

    expect(onCreateFromPdf).toHaveBeenCalledTimes(1)
    expect(onCreateManually).toHaveBeenCalledTimes(1)
  })

  it('lists existing pantries and opens one when clicked', () => {
    const onOpenPantry = vi.fn()
    render(
      <HomeDashboard
        mode="local-private"
        onCreateFromPdf={noop}
        onCreateManually={noop}
        onOpenPantry={onOpenPantry}
        onReplayIntro={noop}
        pantries={[samplePantry]}
      />,
    )

    expect(screen.queryByRole('heading', { name: /Your pantry is empty/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cell biology/i }))
    expect(onOpenPantry).toHaveBeenCalledWith('p1')
  })

  it('offers a replay-intro affordance', () => {
    const onReplayIntro = vi.fn()
    render(
      <HomeDashboard
        mode="local-private"
        onCreateFromPdf={noop}
        onCreateManually={noop}
        onOpenPantry={noop}
        onReplayIntro={onReplayIntro}
        pantries={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Replay intro' }))
    expect(onReplayIntro).toHaveBeenCalledTimes(1)
  })

  it('labels cloud mode honestly as still local until cloud ships', () => {
    render(
      <HomeDashboard
        mode="cloud-enhanced"
        onCreateFromPdf={noop}
        onCreateManually={noop}
        onOpenPantry={noop}
        onReplayIntro={noop}
        pantries={[]}
      />,
    )

    expect(screen.getByText(/cloud coming soon/i)).toBeInTheDocument()
  })
})
