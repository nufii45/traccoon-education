import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkModelCache, checkWebGpu } from './modelReadiness'
import { ModelStatusRow } from './ModelStatusRow'

vi.mock('./modelReadiness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./modelReadiness')>()),
  checkWebGpu: vi.fn(),
  checkModelCache: vi.fn(),
}))

const idle = { stage: 'idle', detail: 'Ready when you are.' } as const

describe('ModelStatusRow', () => {
  beforeEach(() => {
    vi.mocked(checkWebGpu).mockReset()
    vi.mocked(checkModelCache).mockReset()
  })

  it('shows a compact Qwen indicator and keeps diagnostics collapsed by default', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'available', halfPrecision: true })
    vi.mocked(checkModelCache).mockResolvedValue('cached')

    render(<ModelStatusRow status={idle} />)

    expect(await screen.findByText('On-device AI · Offline ready')).toBeInTheDocument()
    expect(screen.getByText('Ready to generate')).toBeInTheDocument()
    expect(screen.getByText('Powered by Qwen3.5 4B')).toBeInTheDocument()
    // The full technical panel is behind a collapsed disclosure.
    const details = screen.getByText('Model details').closest('details')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')
  })

  it('reports a device compatibility issue and no offline label without WebGPU', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'unavailable' })

    render(<ModelStatusRow status={idle} />)

    expect(await screen.findByText('Device compatibility issue')).toBeInTheDocument()
    expect(screen.queryByText('On-device AI · Offline ready')).toBeNull()
  })

  it('does not claim ready or offline while the model is still downloading', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'available', halfPrecision: true })
    vi.mocked(checkModelCache).mockResolvedValue('not-cached')

    render(<ModelStatusRow status={{ stage: 'downloading', detail: 'Fetching', progress: 20 }} />)

    expect(screen.getByText('Preparing offline AI')).toBeInTheDocument()
    expect(screen.queryByText('On-device AI · Offline ready')).toBeNull()
  })
})
