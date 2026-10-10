import type { OcrResult, PaddleOCR, PaddleOCRCreateOptions } from '@paddleocr/paddleocr-js'
import {
  LOCAL_OCR_ENGINE_VERSION,
  LOCAL_OCR_LANG,
  LOCAL_OCR_MODEL_URLS,
  LOCAL_OCR_ORT_WASM_URL,
  LOCAL_OCR_RECOGNITION_TIMEOUT_MS,
  LOCAL_OCR_VERSION,
} from './config'
import {
  cancelledError,
  classifyRecognitionFailure,
  classifyStartFailure,
  LocalOcrError,
  RECOGNITION_TIMEOUT_MESSAGE,
  unsupportedError,
} from './localOcrErrors'
import type {
  LocalOcrResult,
  LocalOcrStatus,
  LocalOcrSupport,
  RecognizeImageOptions,
  WarmUpLocalOcrOptions,
} from './types'

// On-device OCR with PaddleOCR.js. A page image is decoded here, transferred
// to PaddleOCR.js's own module worker, and read there; it is never sent
// anywhere. The only network requests are the pinned runtime and model files
// (config.ts), fetched by that worker the first time the engine starts.

type PaddleOcrEngine = Awaited<ReturnType<typeof PaddleOCR.create>>

const loadPaddleOcr = () => import('@paddleocr/paddleocr-js')

// ONNX Runtime accepts `{ wasm }` as well as a URL prefix. The object form
// keeps the runtime's JavaScript glue inside the bundled same-origin worker and
// fetches only the binary. PaddleOCR.js 0.4.2 types the option as a string but
// passes the value through unchanged.
const ORT_WASM_PATHS = { wasm: LOCAL_OCR_ORT_WASM_URL } as unknown as string

const ENGINE_OPTIONS: PaddleOCRCreateOptions = {
  lang: LOCAL_OCR_LANG,
  ocrVersion: LOCAL_OCR_VERSION,
  // Detection and recognition run in PaddleOCR.js's own module worker. The
  // main thread only decodes the page image and transfers it.
  worker: true,
  // Created first and initialised separately, so a cancelled start-up can
  // dispose the worker, which also stops its downloads.
  initialize: false,
  ortOptions: {
    backend: 'wasm',
    // Threaded WebAssembly needs cross-origin isolation, which this app does
    // not enable. One thread also avoids ONNX Runtime's fallback warnings.
    numThreads: 1,
    wasmPaths: ORT_WASM_PATHS,
  },
}

const DISPOSE_TIMEOUT_MS = 5_000
const CANCELLED_STATUS: LocalOcrStatus = { state: 'idle', message: 'Local OCR was cancelled.' }
const READY_STATUS: LocalOcrStatus = { state: 'ready', progress: 1, message: 'Local OCR is ready on this device.' }

let engine: PaddleOcrEngine | undefined
// Created and initialising; disposed if the start-up is cancelled.
let startingEngine: PaddleOcrEngine | undefined
// The start-up in progress, shared so concurrent callers never build two engines.
let engineLoad: Promise<PaddleOcrEngine> | undefined
// Bumped whenever the engine is discarded, so work that outlives its engine
// reports a cancellation instead of a failure, and never publishes a dead engine.
let generation = 0
// Pages are read one at a time, in call order.
let recognitionQueue: Promise<unknown> = Promise.resolve()

const statusListeners = new Set<(status: LocalOcrStatus) => void>()
let currentStatus: LocalOcrStatus = { state: 'idle' }

const publishStatus = (status: LocalOcrStatus) => {
  currentStatus = status
  for (const listener of statusListeners) {
    listener(status)
  }
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw cancelledError()
  }
}

// Rejects as soon as the signal aborts, even if the task never settles.
const abortable = <T>(task: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) {
    return task
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(cancelledError())
    signal.addEventListener('abort', onAbort, { once: true })
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
    if (signal.aborted) {
      onAbort()
    }
  })
}

const withTimeout = <T>(task: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms)
    task.then(resolve, reject).finally(() => clearTimeout(timer))
  })

// The package asks its worker to release the models, then terminates it. A
// worker that never answers must not block the caller, and a failed disposal
// leaves nothing for the learner to act on.
const disposeEngine = async (target: PaddleOcrEngine): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    target.dispose().catch(() => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, DISPOSE_TIMEOUT_MS)
    }),
  ])
  clearTimeout(timer)
}

const resetEngine = async (): Promise<void> => {
  generation += 1
  const targets = [engine, startingEngine].filter((item): item is PaddleOcrEngine => item !== undefined)
  engine = undefined
  startingEngine = undefined
  engineLoad = undefined
  recognitionQueue = Promise.resolve()
  await Promise.all(targets.map(disposeEngine))
}

// Asks the browser to keep this site's storage under disk pressure, so the
// saved OCR model stays available offline. A refusal changes nothing.
const requestPersistentStorage = async () => {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (storage?.persist && !(await storage.persisted?.())) {
      await storage.persist()
    }
  } catch {
    // Not supported in this browser.
  }
}

// Reads Cache Storage only, to word the start-up status. Unreadable storage
// counts as not saved.
const hasSavedOcrFiles = async (): Promise<boolean> => {
  if (typeof caches === 'undefined') {
    return false
  }

  try {
    const urls = [...LOCAL_OCR_MODEL_URLS, LOCAL_OCR_ORT_WASM_URL]
    const saved = await Promise.all(urls.map((url) => caches.match(url, { ignoreVary: true })))
    return saved.every((response) => response !== undefined)
  } catch {
    return false
  }
}

export const getLocalOcrSupport = (): LocalOcrSupport => {
  if (typeof window === 'undefined' || typeof Worker !== 'function') {
    return { supported: false, reason: 'Web Workers are not available.' }
  }
  if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
    return { supported: false, reason: 'WebAssembly is not available.' }
  }
  if (typeof createImageBitmap !== 'function' || typeof ImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return { supported: false, reason: 'It cannot prepare page images in a background worker.' }
  }
  if (window.location.protocol === 'file:') {
    return { supported: false, reason: 'The app is open from a file rather than a web address.' }
  }
  return { supported: true }
}

const initialiseEngine = async (startedIn: number): Promise<PaddleOcrEngine> => {
  void requestPersistentStorage()
  publishStatus({ state: 'initializing', message: 'Loading the local OCR engine…' })
  const { PaddleOCR: PaddleOcr } = await loadPaddleOcr()
  const saved = await hasSavedOcrFiles()
  if (startedIn !== generation) {
    throw cancelledError()
  }

  publishStatus(
    saved
      ? { state: 'initializing', message: 'Starting local OCR with the model saved on this device…' }
      : { state: 'downloading', message: 'Downloading the local OCR model to this browser. Later runs use the saved copy.' },
  )
  const created = await PaddleOcr.create(ENGINE_OPTIONS)
  if (startedIn !== generation) {
    // No worker exists until initialize(), so there is nothing to dispose.
    throw cancelledError()
  }

  startingEngine = created
  await created.initialize()
  return created
}

const startEngineLoad = (): Promise<PaddleOcrEngine> => {
  const startedIn = generation
  const load: Promise<PaddleOcrEngine> = initialiseEngine(startedIn)
    .then(
      (created) => {
        if (startedIn !== generation) {
          // Discarded while it was finishing.
          void disposeEngine(created)
          throw cancelledError()
        }
        engine = created
        startingEngine = undefined
        publishStatus(READY_STATUS)
        return created
      },
      (error: unknown) => {
        // Whoever discarded this start-up has already reported it.
        if (startedIn !== generation) {
          throw cancelledError()
        }
        const failure = classifyStartFailure(error)
        // A failed start-up can leave a half-initialised worker behind, so the
        // next attempt starts from a fresh one.
        void resetEngine()
        publishStatus({ state: 'error', message: failure.message })
        throw failure
      },
    )
    .finally(() => {
      if (engineLoad === load) {
        engineLoad = undefined
      }
    })
  engineLoad = load
  return load
}

const waitForEngine = async (signal?: AbortSignal): Promise<PaddleOcrEngine> => {
  if (engine) {
    return engine
  }

  const load = engineLoad ?? startEngineLoad()
  try {
    return await abortable(load, signal)
  } catch (error) {
    if (!signal?.aborted) {
      throw error
    }
    // Cancelling during start-up terminates the worker, which stops its downloads.
    if (engineLoad === load && !engine) {
      void resetEngine()
      publishStatus(CANCELLED_STATUS)
    }
    throw cancelledError()
  }
}

/**
 * Starts the shared engine, downloading the runtime and model the first time.
 * Resolves once local OCR is ready. Rejects with a LocalOcrError.
 */
export const warmUpLocalOcr = async (options: WarmUpLocalOcrOptions = {}): Promise<void> => {
  const { onStatus, signal } = options
  throwIfAborted(signal)

  const support = getLocalOcrSupport()
  if (!support.supported) {
    const failure = unsupportedError(support.reason)
    onStatus?.({ state: 'error', message: failure.message })
    throw failure
  }

  if (engine) {
    onStatus?.(READY_STATUS)
    return
  }

  // A wrapper per call, so two callers passing the same callback both hear updates.
  const listener = onStatus ? (status: LocalOcrStatus) => onStatus(status) : undefined
  if (listener) {
    statusListeners.add(listener)
    if (engineLoad) {
      // Joining a start-up already under way: catch up on where it is.
      listener(currentStatus)
    }
  }

  try {
    await waitForEngine(signal)
  } finally {
    if (listener) {
      statusListeners.delete(listener)
    }
  }
}

const toLocalOcrResult = (result: OcrResult | undefined): LocalOcrResult => {
  const lines = (result?.items ?? []).flatMap((item) => {
    const text = typeof item.text === 'string' ? item.text.trim() : ''
    return text ? [{ text, score: item.score }] : []
  })

  return {
    text: lines.map((line) => line.text).join('\n'),
    lines,
    textSource: 'local-ocr',
    engine: { name: 'paddleocr-js', version: LOCAL_OCR_ENGINE_VERSION, ocrVersion: LOCAL_OCR_VERSION },
  }
}

const readPage = async (
  activeEngine: PaddleOcrEngine,
  image: Blob,
  startedIn: number,
  signal?: AbortSignal,
): Promise<LocalOcrResult> => {
  // Cancelled or discarded while it waited behind another page.
  if (signal?.aborted || startedIn !== generation) {
    throw cancelledError()
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(image)
  } catch (error) {
    throw new LocalOcrError(
      'recognition-failed',
      'This page image could not be decoded for local OCR. Try again, or write cards by hand.',
      { cause: error },
    )
  }

  try {
    const results = await withTimeout(
      activeEngine.predict(bitmap),
      LOCAL_OCR_RECOGNITION_TIMEOUT_MS,
      () => new LocalOcrError('recognition-failed', RECOGNITION_TIMEOUT_MESSAGE),
    )
    return toLocalOcrResult(Array.isArray(results) ? results[0] : undefined)
  } catch (error) {
    if (startedIn !== generation) {
      // The engine was disposed while this page was being read.
      throw cancelledError()
    }
    // A failed or stuck run can leave the worker unusable, so the next page
    // starts a fresh one from the saved model.
    void resetEngine()
    throw classifyRecognitionFailure(error)
  } finally {
    // PaddleOCR.js transfers its own copy to the worker.
    bitmap.close()
  }
}

/**
 * Reads the text in one page image on this device. Starts the engine first if
 * no warm-up has. Rejects with a LocalOcrError.
 */
export const recognizeImage = async (image: Blob, options: RecognizeImageOptions = {}): Promise<LocalOcrResult> => {
  const { signal } = options
  throwIfAborted(signal)

  const support = getLocalOcrSupport()
  if (!support.supported) {
    throw unsupportedError(support.reason)
  }

  const activeEngine = await waitForEngine(signal)
  const startedIn = generation
  // The queue waits for the worker itself, so a cancelled page that is still
  // being read never overlaps the next one.
  const task = recognitionQueue.then(() => readPage(activeEngine, image, startedIn, signal))
  recognitionQueue = task.catch(() => undefined)
  return abortable(task, signal)
}

export const extractTextFromImage = async (image: Blob): Promise<string> => (await recognizeImage(image)).text

/**
 * Releases the engine and its worker. Any start-up or page still running
 * rejects with code 'cancelled'. The saved model stays cached for next time.
 */
export const disposeLocalOcr = async (): Promise<void> => {
  await resetEngine()
  publishStatus({ state: 'idle' })
}
