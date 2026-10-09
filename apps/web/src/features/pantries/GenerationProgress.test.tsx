import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LocalAiStatus } from '../local-ai/localAiClient'
import { GenerationProgress } from './GenerationProgress'

const renderStatus = (status: LocalAiStatus) => render(<GenerationProgress status={status} />)

describe('GenerationProgress', () => {
  it.each([
    [{ stage: 'checking', detail: 'Checking this browser for WebGPU…' }, 'Checking this browser'],
    [{ stage: 'downloading', detail: 'Fetching param cache', progress: 42 }, 'Downloading the model, 42%'],
    [{ stage: 'downloading', detail: 'Loading model files from cache' }, 'Preparing the model'],
    [{ stage: 'generating', detail: 'Generating cards locally in your browser…' }, 'Generating cards'],
  ] as const)('shows a spinner with a screen-reader label while %s', (status, label) => {
    renderStatus(status)

    const region = screen.getByRole('status')
    expect(region.querySelector('[data-state="working"]')).not.toBeNull()
    expect(region).toHaveTextContent(label)
    // The runtime's progress sentence is replaced, not shown.
    expect(region).not.toHaveTextContent(status.detail)
  })

  it('turns the spinner into a checkmark once cards are generated', () => {
    const { rerender } = renderStatus({ stage: 'generating', detail: 'Generating' })
    const indicator = screen.getByRole('status').querySelector('svg')

    rerender(<GenerationProgress status={{ stage: 'ready', detail: 'Cards were generated locally and passed source checks.' }} />)

    // Same element, so the ring and check can animate from the spinner state.
    expect(screen.getByRole('status').querySelector('svg')).toBe(indicator)
    expect(indicator).toHaveAttribute('data-state', 'done')
    expect(screen.getByRole('status')).toHaveTextContent('Cards generated')
  })

  it.each([
    [{ stage: 'idle', detail: 'Ready when you are.' }],
    [{ stage: 'unsupported', detail: 'WebGPU is unavailable in this browser.' }],
    [{ stage: 'error', detail: 'The local model could not start.' }],
    [{ stage: 'cancelled', detail: 'Local generation was cancelled.' }],
  ] as const)('shows the message without an indicator when %s', (status) => {
    renderStatus(status)

    const region = screen.getByRole('status')
    expect(region.querySelector('svg')).toBeNull()
    expect(region).toHaveTextContent(status.detail)
  })
})
