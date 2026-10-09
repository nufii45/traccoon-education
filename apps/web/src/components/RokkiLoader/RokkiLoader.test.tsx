import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GenerationLoader } from '../../features/pantries/GenerationLoader'
import { RokkiLoader, RokkiLoadingScreen } from './RokkiLoader'

describe('RokkiLoader', () => {
  it('announces the mode copy and shows no progressbar without real progress', () => {
    render(<RokkiLoader mode="generating" />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Rokki is making your cards.')
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(status.querySelector('img')).toHaveAttribute('src', '/assets/rokki/rokki-classic.svg')
  })

  it('reports supplied progress, clamped to 0–100', () => {
    render(<RokkiLoader mode="preparing" progress={140} title="Downloading" />)

    expect(screen.getByRole('progressbar', { name: 'Downloading' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('100% complete')).toBeInTheDocument()
  })

  it('keeps an accessible name when the label is hidden', () => {
    render(<RokkiLoader mode="saving" showLabel={false} size="sm" />)

    expect(screen.getByRole('status')).toHaveTextContent('Saving to your pantry.')
  })

  it('can stay silent when another live region announces the operation', () => {
    render(<RokkiLoader announce={false} mode="generating" />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Rokki is making your cards.')).toBeInTheDocument()
  })

  it('prefixes the mascot with a custom base path', () => {
    render(<RokkiLoadingScreen assetBasePath="/traccoon" label="Loading" />)

    expect(screen.getByRole('region', { name: 'Loading' }).querySelector('img')).toHaveAttribute('src', '/traccoon/assets/rokki/rokki-classic.svg')
  })
})

describe('GenerationLoader', () => {
  it('shows real download progress, an indeterminate generating state, and nothing otherwise', () => {
    const { rerender, container } = render(<GenerationLoader status={{ stage: 'downloading', detail: '', progress: 42 }} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')

    rerender(<GenerationLoader status={{ stage: 'generating', detail: '' }} />)
    expect(screen.getByText('Rokki is making your cards.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()

    for (const stage of ['idle', 'ready', 'error', 'cancelled', 'unsupported'] as const) {
      rerender(<GenerationLoader status={{ stage, detail: '' }} />)
      expect(container).toBeEmptyDOMElement()
    }
  })
})
