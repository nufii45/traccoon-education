import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCAL_COMPATIBILITY_MODEL_ID, LOCAL_MODEL_ID } from '../local-ai/localAiClient'
import { checkModelCache, checkWebGpu } from './modelReadiness'
import { ModelReadinessPanel } from './ModelReadinessPanel'

vi.mock('./modelReadiness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./modelReadiness')>()),
  checkWebGpu: vi.fn(),
  checkModelCache: vi.fn(),
}))

const idle = { stage: 'idle', detail: 'Ready when you are.' } as const

describe('ModelReadinessPanel', () => {
  beforeEach(() => {
    vi.mocked(checkWebGpu).mockReset()
    vi.mocked(checkModelCache).mockReset()
  })

  it('names the model and routes to manual authoring when WebGPU is missing', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'unavailable' })

    render(<ModelReadinessPanel status={idle} />)

    expect(screen.getByText(LOCAL_MODEL_ID)).toBeInTheDocument()
    expect(await screen.findByText(/No WebGPU here/)).toBeInTheDocument()
    expect(screen.queryByText('Model files')).not.toBeInTheDocument()
    expect(checkModelCache).not.toHaveBeenCalled()
  })

  it('says the first run downloads the model when it is not saved yet', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'available', halfPrecision: true })
    vi.mocked(checkModelCache).mockResolvedValue('not-cached')

    render(<ModelReadinessPanel status={idle} />)

    expect(await screen.findByText(/Not downloaded yet/)).toBeInTheDocument()
    expect(screen.getByText('WebGPU is available')).toBeInTheDocument()
  })

  it('confirms offline readiness when the model files are saved', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'available', halfPrecision: true })
    vi.mocked(checkModelCache).mockResolvedValue('cached')

    render(<ModelReadinessPanel status={idle} />)

    expect(await screen.findByText('Saved on this device. Works offline.')).toBeInTheDocument()
  })

  it('names and checks the compatibility build on a GPU without shader-f16', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'available', halfPrecision: false })
    vi.mocked(checkModelCache).mockResolvedValue('cached')

    render(<ModelReadinessPanel status={idle} />)

    expect(await screen.findByText(LOCAL_COMPATIBILITY_MODEL_ID)).toBeInTheDocument()
    expect(screen.queryByText(LOCAL_MODEL_ID)).toBeNull()
    expect(checkModelCache).toHaveBeenCalledWith(LOCAL_COMPATIBILITY_MODEL_ID)
    expect(screen.getByText('Saved on this device. Works offline.')).toBeInTheDocument()
  })

  it('checks the primary build when the GPU supports shader-f16', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'available', halfPrecision: true })
    vi.mocked(checkModelCache).mockResolvedValue('not-cached')

    render(<ModelReadinessPanel status={idle} />)

    await screen.findByText(/Not downloaded yet/)
    expect(checkModelCache).toHaveBeenCalledWith(LOCAL_MODEL_ID)
    expect(screen.getByText(LOCAL_MODEL_ID)).toBeInTheDocument()
  })

  it('shows download progress while the model arrives', async () => {
    vi.mocked(checkWebGpu).mockResolvedValue({ support: 'available', halfPrecision: true })
    vi.mocked(checkModelCache).mockResolvedValue('not-cached')

    render(<ModelReadinessPanel status={{ stage: 'downloading', detail: 'Fetching', progress: 42 }} />)

    expect(screen.getByRole('progressbar', { name: 'Model download progress' })).toHaveAttribute('value', '42')
    expect(screen.getByText('42%')).toBeInTheDocument()
    await screen.findByText(/Not downloaded yet/)
  })
})
