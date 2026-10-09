import { describe, expect, it, vi } from 'vitest'
import { checkModelCache, checkWebGpu } from './modelReadiness'

describe('checkWebGpu', () => {
  it('reports unavailable when the browser has no WebGPU object', async () => {
    await expect(checkWebGpu(undefined)).resolves.toBe('unavailable')
  })

  it('reports unavailable when no GPU adapter is granted', async () => {
    await expect(checkWebGpu({ requestAdapter: async () => null })).resolves.toBe('unavailable')
  })

  it('reports unavailable when the adapter request fails', async () => {
    await expect(checkWebGpu({ requestAdapter: async () => { throw new Error('blocked') } })).resolves.toBe('unavailable')
  })

  it('reports available when an adapter is granted', async () => {
    await expect(checkWebGpu({ requestAdapter: async () => ({}) })).resolves.toBe('available')
  })
})

describe('checkModelCache', () => {
  it('reports cached when the runtime finds the model files', async () => {
    const hasModelInCache = vi.fn(async () => true)

    await expect(checkModelCache('model-id', hasModelInCache)).resolves.toBe('cached')
    expect(hasModelInCache).toHaveBeenCalledWith('model-id')
  })

  it('reports not cached when the files are missing', async () => {
    await expect(checkModelCache('model-id', async () => false)).resolves.toBe('not-cached')
  })

  it('reports unknown instead of guessing when the cache cannot be read', async () => {
    await expect(checkModelCache('model-id', async () => { throw new Error('denied') })).resolves.toBe('unknown')
  })
})
