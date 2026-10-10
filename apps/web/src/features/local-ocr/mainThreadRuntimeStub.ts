// Stands in for OpenCV.js and ONNX Runtime Web when PaddleOCR.js loads on the
// main thread; vite.config.ts points only PaddleOCR.js's own imports here.
// Traccoon always creates the engine with `worker: true`, and the package's
// prebuilt worker carries its own copies of both, so the main thread never
// calls them. Without this stub the build would ship a 10 MB OpenCV.js chunk
// the main thread never uses and a 27 MiB ONNX Runtime binary, which is over
// Cloudflare's 25 MiB per-file asset limit.

const workerOnly = (): never => {
  throw new Error('PaddleOCR.js runs OpenCV.js and ONNX Runtime only inside its worker here. Create it with worker: true.')
}

// Any property read fails loudly, so a main-thread code path cannot hang
// waiting for a runtime that will never initialise.
const workerOnlyRuntime: object = new Proxy({}, { get: workerOnly })

export default workerOnlyRuntime
export const env = workerOnlyRuntime
export const InferenceSession = workerOnlyRuntime
export const Tensor = workerOnlyRuntime
