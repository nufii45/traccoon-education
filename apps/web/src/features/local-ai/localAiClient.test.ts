import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateCardsLocally,
  LocalGenerationUnsupportedError,
} from './localAiClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Local Private network boundary', () => {
  it('does not request a fallback service when WebGPU is unavailable', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(
      generateCardsLocally({
        chunks: [],
        sourcePages: [],
      }),
    ).rejects.toBeInstanceOf(LocalGenerationUnsupportedError)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
