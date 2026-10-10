import { classifyLocalAiFailure, GPU_UNAVAILABLE_MESSAGE, type LocalAiFailurePhase } from './localAiErrors'
import {
  analyseModelCards,
  buildLocalGenerationPrompt,
  LOCAL_CARD_RESPONSE_SCHEMA,
  selectPromptChunks,
} from './localGenerator'
import { MAX_CARDS_PER_RUN, MAX_REGENERATION_RETRIES } from './policy'
import { loadWebLlm } from './webLlmRuntime'
import type {
  CardRejectionReason,
  GeneratedCard,
  GenerationDiagnostics,
  SourceChunk,
  SourcePage,
} from './types'
import type { ChatCompletion, ChatCompletionRequestNonStreaming, WebWorkerMLCEngine } from '@mlc-ai/web-llm'

export const LOCAL_MODEL_ID = 'Qwen3.5-4B-q4f16_1-MLC'
// The same model and size compiled without half-precision shaders. It runs on
// GPUs that do not expose `shader-f16`, which the default build requires.
export const LOCAL_COMPATIBILITY_MODEL_ID = 'Qwen3.5-4B-q4f32_1-MLC'

// Regeneration samples a little more freely so a retry is not the same answer
// again. The first attempt stays close to deterministic.
const ATTEMPT_TEMPERATURES = [0.15, 0.35, 0.55]

export type LocalAiStatus =
  | { stage: 'idle'; detail: string }
  | { stage: 'checking'; detail: string }
  | { stage: 'downloading'; detail: string; progress?: number }
  | { stage: 'ready'; detail: string }
  | { stage: 'generating'; detail: string }
  | { stage: 'cancelled'; detail: string }
  | { stage: 'unsupported'; detail: string }
  | { stage: 'error'; detail: string }

export interface LocalGenerationRequest {
  chunks: SourceChunk[]
  sourcePages: SourcePage[]
  requestedCount?: number
  onStatus?: (status: LocalAiStatus) => void
  signal?: AbortSignal
}

export interface LocalGenerationResult {
  cards: GeneratedCard[]
  method: 'webllm'
}

let worker: Worker | undefined
let engine: WebWorkerMLCEngine | undefined
// The load in progress, shared so two callers never build two engines on one worker.
let engineLoad: Promise<WebWorkerMLCEngine> | undefined
// Bumped whenever the worker is discarded, so a load that outlives its worker
// notices and stops instead of publishing a dead engine.
let epoch = 0
// Set once the default build fails to initialise on this GPU and the
// compatibility build succeeds, so later runs skip the failing build.
let preferCompatibilityModel = false
// Grammar-constrained JSON output. Disabled for the session if the engine
// rejects it, so an unsupported model still generates without JSON mode.
let jsonModeSupported = true

export class LocalGenerationCancelledError extends Error {
  constructor() {
    super('Local generation was cancelled.')
    this.name = 'LocalGenerationCancelledError'
  }
}

export class LocalGenerationUnsupportedError extends Error {
  constructor(
    message = 'WebGPU is unavailable in this browser. Use Chrome or Edge on the demo Mac, or author cards manually.',
  ) {
    super(message)
    this.name = 'LocalGenerationUnsupportedError'
  }
}

// The model could not start or stopped while running. The message is written
// for the learner; the original failure is kept as `cause`.
export class LocalGenerationEngineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'LocalGenerationEngineError'
  }
}

// Reason codes and counts only, never learner content.
export const formatGenerationDiagnostics = (diagnostics: GenerationDiagnostics): string => {
  const list = (Object.entries(diagnostics.reasons) as [CardRejectionReason, number][])
    .filter(([, count]) => count > 0)
    .sort(([codeA, countA], [codeB, countB]) => countB - countA || codeA.localeCompare(codeB))
    .map(([code, count]) => `${count} ${code}`)
    .join(', ')

  const summary = `Checked ${diagnostics.responses} local response(s): 0 of ${diagnostics.candidates} candidates passed`
  return list ? `${summary} (${list}).` : `${summary}.`
}

export class LocalGenerationOutputError extends Error {
  readonly diagnostics?: GenerationDiagnostics

  constructor(diagnostics?: GenerationDiagnostics) {
    const lead = 'The local model could not produce source-verified cards. Try a smaller selection or author a card manually.'
    super(diagnostics ? `${lead} ${formatGenerationDiagnostics(diagnostics)}` : lead)
    this.name = 'LocalGenerationOutputError'
    this.diagnostics = diagnostics
  }
}

const throwIfCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new LocalGenerationCancelledError()
  }
}

// Rejects as soon as the signal aborts, even if the task never settles, for
// example because its worker was terminated mid-download. Without this a
// cancelled run would leave the interface waiting forever.
const abortable = <T>(task: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) {
    return task
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new LocalGenerationCancelledError())
    signal.addEventListener('abort', onAbort, { once: true })
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
    if (signal.aborted) {
      onAbort()
    }
  })
}

const describeWorkerEvent = (event: Event): string => {
  const message = (event as Partial<ErrorEvent>).message
  return typeof message === 'string' && message.trim()
    ? `The local model worker stopped: ${message}`
    : 'The local model worker could not be loaded.'
}

// A worker whose script fails to load or crashes never answers the engine's
// requests, which would leave initialisation pending forever.
const failOnWorkerError = <T>(task: Promise<T>, activeWorker: Worker): Promise<T> => {
  if (typeof activeWorker.addEventListener !== 'function') {
    return task
  }

  return new Promise<T>((resolve, reject) => {
    const onError = (event: Event) => reject(new Error(describeWorkerEvent(event)))
    activeWorker.addEventListener('error', onError)
    activeWorker.addEventListener('messageerror', onError)
    task.then(resolve, reject).finally(() => {
      activeWorker.removeEventListener('error', onError)
      activeWorker.removeEventListener('messageerror', onError)
    })
  })
}

// Drops the worker and everything bound to it. Terminating the worker also
// stops an in-progress model download.
const discardWorker = () => {
  worker?.terminate()
  worker = undefined
  engine = undefined
  engineLoad = undefined
  epoch += 1
}

// Asks the browser to keep this site's storage under disk pressure, so the
// downloaded model stays available offline. Chromium answers without a
// prompt. A refusal changes nothing: the model still loads from the regular
// cache, and a missing file is reported when the model next loads.
const requestPersistentModelStorage = async () => {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (storage?.persist && !(await storage.persisted?.())) {
      await storage.persist()
    }
  } catch {
    // Not supported in this browser.
  }
}

const startEngineLoad = async (
  modelId: string,
  onStatus?: (status: LocalAiStatus) => void,
): Promise<WebWorkerMLCEngine> => {
  const startedAt = epoch
  void requestPersistentModelStorage()
  onStatus?.({ stage: 'downloading', detail: `Preparing ${modelId} on this device…`, progress: 0 })
  const webllm = await loadWebLlm()
  if (epoch !== startedAt) {
    throw new LocalGenerationCancelledError()
  }

  const activeWorker = new Worker(new URL('../../workers/localAi.worker.ts', import.meta.url), { type: 'module' })
  worker = activeWorker

  try {
    const created = await failOnWorkerError(
      webllm.CreateWebWorkerMLCEngine(activeWorker, modelId, {
        initProgressCallback: (report) => {
          onStatus?.({
            stage: 'downloading',
            detail: report.text,
            progress: Math.round(report.progress * 100),
          })
        },
      }),
      activeWorker,
    )
    if (epoch !== startedAt) {
      // Cancelled or released while the model was initialising.
      throw new LocalGenerationCancelledError()
    }
    engine = created
    return created
  } catch (error) {
    // A failed initialisation can leave GPU memory and a half-built engine in
    // the worker, so the next attempt starts from a fresh one.
    if (worker === activeWorker) {
      discardWorker()
    }
    throw error
  }
}

const loadEngine = (modelId: string, onStatus?: (status: LocalAiStatus) => void): Promise<WebWorkerMLCEngine> => {
  if (engine) {
    return Promise.resolve(engine)
  }

  if (engineLoad) {
    return engineLoad
  }

  const load: Promise<WebWorkerMLCEngine> = startEngineLoad(modelId, onStatus).finally(() => {
    // A newer load may have replaced this one after a cancel; leave it alone.
    if (engineLoad === load) {
      engineLoad = undefined
    }
  })
  engineLoad = load
  return load
}

interface WebGpuAdapterLike {
  features?: { has: (feature: string) => boolean }
}

interface WebGpuLike {
  requestAdapter?: (options?: { powerPreference?: 'high-performance' }) => Promise<WebGpuAdapterLike | null>
}

// `halfPrecision` is undefined when the browser did not say.
type GpuReport = { adapter: 'missing' } | { adapter: 'present'; halfPrecision?: boolean }

const probeGpu = async (gpu: WebGpuLike): Promise<GpuReport> => {
  if (typeof gpu.requestAdapter !== 'function') {
    return { adapter: 'present' }
  }

  try {
    // The same preference web-llm uses, so both pick the same GPU on dual-GPU laptops.
    // Some drivers answer one request shape and not the other, so ask again
    // without a preference before concluding there is no GPU.
    const adapter = (await gpu.requestAdapter({ powerPreference: 'high-performance' })) ?? (await gpu.requestAdapter())
    if (!adapter) {
      return { adapter: 'missing' }
    }
    return { adapter: 'present', halfPrecision: adapter.features?.has('shader-f16') }
  } catch {
    // The engine meets the same condition during initialisation and reports
    // its own error, which is then shown to the learner.
    return { adapter: 'present' }
  }
}

const chooseModelId = (report: GpuReport): string =>
  preferCompatibilityModel || (report.adapter === 'present' && report.halfPrecision === false)
    ? LOCAL_COMPATIBILITY_MODEL_ID
    : LOCAL_MODEL_ID

const reportUnsupported = (request: LocalGenerationRequest, error: LocalGenerationUnsupportedError) => {
  request.onStatus?.({ stage: 'unsupported', detail: error.message })
  return error
}

// Loads the engine. If the default half-precision build fails to compile on
// this GPU, the full-precision build of the same model gets one try.
const startEngine = async (
  initialModelId: string,
  request: LocalGenerationRequest,
): Promise<{ activeEngine: WebWorkerMLCEngine; modelId: string }> => {
  try {
    const activeEngine = await abortable(loadEngine(initialModelId, request.onStatus), request.signal)
    return { activeEngine, modelId: initialModelId }
  } catch (error) {
    const canFallBack =
      initialModelId === LOCAL_MODEL_ID
      && !request.signal?.aborted
      && !(error instanceof LocalGenerationCancelledError)
      && classifyLocalAiFailure(error, 'start').tryCompatibilityModel
    if (!canFallBack) {
      throw error
    }

    request.onStatus?.({
      stage: 'downloading',
      detail: `This GPU could not run ${initialModelId}. Trying ${LOCAL_COMPATIBILITY_MODEL_ID}…`,
      progress: 0,
    })
    const activeEngine = await abortable(loadEngine(LOCAL_COMPATIBILITY_MODEL_ID, request.onStatus), request.signal)
    preferCompatibilityModel = true
    return { activeEngine, modelId: LOCAL_COMPATIBILITY_MODEL_ID }
  }
}

// Runs one completion, trying JSON mode first. If the engine throws while JSON
// mode is on, the same attempt runs once without it; this does not consume a
// regeneration attempt. JSON mode is switched off for the session only when
// that rerun succeeds, so an unrelated failure does not disable it.
const createCompletion = async (
  activeEngine: WebWorkerMLCEngine,
  base: ChatCompletionRequestNonStreaming,
  signal?: AbortSignal,
): Promise<ChatCompletion> => {
  const withoutJsonMode = () => abortable(activeEngine.chat.completions.create(base), signal)
  if (!jsonModeSupported) {
    return withoutJsonMode()
  }

  try {
    return await abortable(
      activeEngine.chat.completions.create({
        ...base,
        response_format: { type: 'json_object', schema: LOCAL_CARD_RESPONSE_SCHEMA },
      }),
      signal,
    )
  } catch (error) {
    // A lost GPU or crashed engine fails the same way without JSON mode, and
    // the rerun would only hold the broken engine longer.
    if (
      signal?.aborted
      || error instanceof LocalGenerationCancelledError
      || classifyLocalAiFailure(error, 'run').resetEngine
    ) {
      throw error
    }
    const completion = await withoutJsonMode()
    jsonModeSupported = false
    return completion
  }
}

export const generateCardsLocally = async (
  request: LocalGenerationRequest,
): Promise<LocalGenerationResult> => {
  const requestedCount = Math.min(request.requestedCount ?? MAX_CARDS_PER_RUN, MAX_CARDS_PER_RUN)
  const cancel = () => {
    void cancelLocalGeneration()
  }
  let phase: LocalAiFailurePhase = 'start'

  request.signal?.addEventListener('abort', cancel, { once: true })
  request.onStatus?.({ stage: 'checking', detail: 'Checking this browser for WebGPU…' })

  try {
    throwIfCancelled(request.signal)
    const gpu = (navigator as Navigator & { gpu?: WebGpuLike }).gpu
    if (!gpu) {
      throw reportUnsupported(request, new LocalGenerationUnsupportedError())
    }

    const report = await abortable(probeGpu(gpu), request.signal)
    if (report.adapter === 'missing') {
      throw reportUnsupported(request, new LocalGenerationUnsupportedError(GPU_UNAVAILABLE_MESSAGE))
    }

    const { activeEngine, modelId } = await startEngine(chooseModelId(report), request)
    throwIfCancelled(request.signal)
    phase = 'run'
    request.onStatus?.({ stage: 'ready', detail: `${modelId} is ready on this device.` })

    // Cards are still verified against every chunk and page; only the prompt is
    // kept inside the model's context window.
    const prompt = buildLocalGenerationPrompt(selectPromptChunks(request.chunks), requestedCount)
    const diagnostics: GenerationDiagnostics = { responses: 0, candidates: 0, reasons: {} }
    for (let attempt = 0; attempt <= MAX_REGENERATION_RETRIES; attempt += 1) {
      request.onStatus?.({
        stage: 'generating',
        detail: attempt === 0
          ? 'Generating cards locally in your browser…'
          : `Checking another local response (${attempt + 1} of ${MAX_REGENERATION_RETRIES + 1})…`,
      })
      const completion = await createCompletion(
        activeEngine,
        {
          messages: [
            {
              role: 'system',
              content:
                'You create precise study cards using only the provided source text and return valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: ATTEMPT_TEMPERATURES[Math.min(attempt, ATTEMPT_TEMPERATURES.length - 1)],
          max_tokens: 1_200,
          // Qwen3.5 reasons in a <think> block by default, which spends the
          // token budget and GPU time before any JSON appears. This is the
          // model's documented non-thinking mode.
          extra_body: { enable_thinking: false },
        },
        request.signal,
      )
      throwIfCancelled(request.signal)
      const content = String(completion.choices[0]?.message.content ?? '')
      const analysis = analyseModelCards(content, request.chunks, request.sourcePages)
      const cards = analysis.cards.slice(0, requestedCount)

      if (cards.length > 0) {
        request.onStatus?.({ stage: 'ready', detail: 'Cards were generated locally and passed source checks.' })
        return { cards, method: 'webllm' }
      }

      diagnostics.responses += 1
      diagnostics.candidates += analysis.candidateCount
      for (const reason of analysis.rejections) {
        diagnostics.reasons[reason] = (diagnostics.reasons[reason] ?? 0) + 1
      }
    }

    throw new LocalGenerationOutputError(diagnostics)
  } catch (error) {
    if (error instanceof LocalGenerationCancelledError || request.signal?.aborted) {
      request.onStatus?.({ stage: 'cancelled', detail: 'Local generation was cancelled. Your source stayed unchanged.' })
      throw new LocalGenerationCancelledError()
    }

    // Already reported as 'unsupported' where it was detected.
    if (error instanceof LocalGenerationUnsupportedError) {
      throw error
    }

    if (error instanceof LocalGenerationOutputError) {
      request.onStatus?.({ stage: 'error', detail: error.message })
      throw error
    }

    // Worker errors arrive as plain strings, so classify them into a message
    // the learner can act on and rethrow a real Error.
    const failure = classifyLocalAiFailure(error, phase)
    if (failure.resetEngine) {
      discardWorker()
    }
    if (failure.unsupported) {
      throw reportUnsupported(request, new LocalGenerationUnsupportedError(failure.message))
    }
    request.onStatus?.({ stage: 'error', detail: failure.message })
    throw new LocalGenerationEngineError(failure.message, { cause: error })
  } finally {
    request.signal?.removeEventListener('abort', cancel)
  }
}

export const cancelLocalGeneration = async () => {
  if (engine) {
    engine.interruptGenerate()
    return
  }

  // Still initialising: dropping the worker stops the download and unblocks
  // the pending load.
  discardWorker()
}

export const releaseLocalModel = async () => {
  try {
    await engine?.unload()
  } finally {
    discardWorker()
    preferCompatibilityModel = false
    jsonModeSupported = true
  }
}
