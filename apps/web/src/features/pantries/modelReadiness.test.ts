import { describe, expect, it, vi } from 'vitest'
import { checkModelCache, checkWebGpu, expectedModelId } from './modelReadiness'

const adapterWith = (features: string[]) => ({ requestAdapter: async () => ({ features: new Set(features) }) })

describe('checkWebGpu', () => {
  it('reports unavailable when the browser has no WebGPU object', async () => {
    await expect(checkWebGpu(undefined)).resolves.toEqual({ support: 'unavailable' })
  })

  it('reports unavailable when no GPU adapter is granted', async () => {
    await expect(checkWebGpu({ requestAdapter: async () => null })).resolves.toEqual({ support: 'unavailable' })
  })

  it('reports unavailable when the adapter request fails', async () => {
    await expect(checkWebGpu({ requestAdapter: async () => { throw new Error('blocked') } })).resolves.toEqual({ support: 'unavailable' })
  })

  it('reports half-precision support from the adapter features', async () => {
    await expect(checkWebGpu(adapterWith(['shader-f16']))).resolves.toEqual({ support: 'available', halfPrecision: true })
    await expect(checkWebGpu(adapterWith([]))).resolves.toEqual({ support: 'available', halfPrecision: false })
  })

  it('leaves half precision unknown when the adapter does not list features', async () => {
    await expect(checkWebGpu({ requestAdapter: async () => ({}) })).resolves.toEqual({ support: 'available', halfPrecision: undefined })
  })
})

describe('expectedModelId', () => {
  const models = { primary: 'model-f16', compatibility: 'model-f32' }

  it('uses the compatibility build only when the GPU lacks shader-f16', () => {
    expect(expectedModelId(false, models)).toBe('model-f32')
  })

  it('uses the primary build when shader-f16 is present or unreported, like the runtime', () => {
    expect(expectedModelId(true, models)).toBe('model-f16')
    expect(expectedModelId(undefined, models)).toBe('model-f16')
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
