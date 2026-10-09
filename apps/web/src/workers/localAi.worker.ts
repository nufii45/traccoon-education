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

const handler = new WebWorkerMLCEngineHandler()

self.onmessage = (event) => handler.onmessage(event)
