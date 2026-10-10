// Pinned settings for on-device OCR with PaddleOCR.js. Everything here is an
// engine setting or a public asset location, never learner content. The
// service-worker rules in vite.config.ts mirror these URLs; change both together.

// The exact release in package.json. Bump both together.
export const LOCAL_OCR_ENGINE_VERSION = '0.4.2'
export const LOCAL_OCR_VERSION = 'PP-OCRv5'
export const LOCAL_OCR_LANG = 'en'

// PaddleOCR.js 0.4.2 runs inference in its own prebuilt module worker, which
// bundles ONNX Runtime Web 1.24.3 and its JavaScript glue. The worker fetches
// the matching WebAssembly binary at start-up, and it must come from exactly
// that release. The onnxruntime-web in node_modules is newer, so it cannot
// stand in. The package falls back to this same jsDelivr release by default.
export const LOCAL_OCR_ORT_WASM_URL =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.jsep.wasm'

// The detection and recognition models PaddleOCR.js 0.4.2 picks for
// `lang: 'en'` with `ocrVersion: 'PP-OCRv5'`. The worker downloads them; they
// are listed here only to check whether they are already saved offline.
export const LOCAL_OCR_MODEL_URLS: readonly string[] = [
  'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx_infer.tar',
  'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx_infer.tar',
]

// One page normally takes a few seconds. A worker that never answers must not
// leave the interface waiting forever.
export const LOCAL_OCR_RECOGNITION_TIMEOUT_MS = 120_000
