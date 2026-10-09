/**
 * Pre-generation readiness for the Local Private model (Task 3: model
 * readiness state). Both checks run entirely in the browser: the WebGPU check
 * asks for a local adapter, and the cache check only reads Cache Storage, so
 * neither sends a request or any study content.
 */

export type WebGpuSupport = 'available' | 'unavailable'
export type ModelCacheState = 'cached' | 'not-cached' | 'unknown'

interface WebGpuLike {
  requestAdapter: () => Promise<unknown>
}

type HasModelInCache = (modelId: string) => Promise<boolean>

const browserWebGpu = (): WebGpuLike | undefined =>
  (navigator as Navigator & { gpu?: WebGpuLike }).gpu

const runtimeHasModelInCache: HasModelInCache = async (modelId) => {
  const webllm = await import('@mlc-ai/web-llm')
  return webllm.hasModelInCache(modelId)
}

/** Resolves `available` only when the browser grants a WebGPU adapter. */
export const checkWebGpu = async (gpu: WebGpuLike | undefined = browserWebGpu()): Promise<WebGpuSupport> => {
  if (!gpu) {
    return 'unavailable'
  }

  try {
    return (await gpu.requestAdapter()) ? 'available' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

/**
 * Reports whether the model's files are already saved in this browser.
 * Returns `unknown` when Cache Storage cannot be read, so the UI never claims
 * offline readiness it has not confirmed.
 */
export const checkModelCache = async (
  modelId: string,
  hasModelInCache: HasModelInCache = runtimeHasModelInCache,
): Promise<ModelCacheState> => {
  try {
    return (await hasModelInCache(modelId)) ? 'cached' : 'not-cached'
  } catch {
    return 'unknown'
  }
}
