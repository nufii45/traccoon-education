import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

// web-llm asks for the high-performance GPU only. On some Windows setups that
// request returns no adapter even though a request without a preference
// succeeds, which stops the model with "Unable to find a compatible GPU".
// Retry once without a preference so the engine can use the GPU that exists.
const gpu: GPU | undefined = self.navigator.gpu
const requestAdapter = gpu?.requestAdapter.bind(gpu)
if (gpu && requestAdapter) {
  gpu.requestAdapter = async (options) =>
    (await requestAdapter(options)) ?? (options === undefined ? null : requestAdapter())
}

// The runtime records a whole prefill chunk into one GPU submission. The
// compiled chunk is 1,024 tokens, so a long selection keeps an integrated GPU
// busy for many seconds in a single submission, long enough for the operating
// system to reset the GPU. The browser then reports the device as lost, the
// runtime disposes itself, and generation fails with "The current Object has
// already been disposed". Shorter chunks keep every submission brief. The
// compiled size is an upper bound, so any smaller chunk is valid.
//
// Measured on Intel Iris Xe with Qwen3.5-0.8B and a 1,154-token prompt:
// 1,024-token chunks prefilled at 65 tokens/s (about 16 s in one submission)
// and reset the GPU on a repeat run; 32-token chunks prefilled at 99 tokens/s
// (about 0.3 s per submission) and produced the same cards.
const MAX_PREFILL_CHUNK_TOKENS = 32

interface PipelineInternals {
  prefillChunkSize?: unknown
}

// `loadedModelIdToPipeline` is internal to web-llm 0.2.85, which this app pins.
// If a later version renames it, this does nothing and the compiled size applies.
const capPrefillChunks = (target: unknown) => {
  const pipelines = (target as { loadedModelIdToPipeline?: unknown }).loadedModelIdToPipeline
  if (!(pipelines instanceof Map)) {
    return
  }

  for (const pipeline of pipelines.values() as Iterable<PipelineInternals>) {
    if (typeof pipeline.prefillChunkSize === 'number' && pipeline.prefillChunkSize > MAX_PREFILL_CHUNK_TOKENS) {
      pipeline.prefillChunkSize = MAX_PREFILL_CHUNK_TOKENS
    }
  }
}

const handler = new WebWorkerMLCEngineHandler()

// Every load goes through `reload`, including the reload the handler runs when
// the requested model does not match the loaded one.
const engine = handler.engine
const reload = engine.reload.bind(engine)
engine.reload = async (modelId, chatOpts) => {
  await reload(modelId, chatOpts)
  capPrefillChunks(engine)
}

self.onmessage = (event) => handler.onmessage(event)
