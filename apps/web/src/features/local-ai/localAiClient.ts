import { classifyLocalAiFailure, type LocalAiFailurePhase } from './localAiErrors'
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

const awaitWithCancellation = <Value>(operation: Promise<Value>, signal?: AbortSignal): Promise<Value> => {
  throwIfCancelled(signal)

  if (!signal) {
    return operation
  }

  return new Promise<Value>((resolve, reject) => {
    const cancel = () => {
      cleanup()
      reject(new LocalGenerationCancelledError())
    }
    const cleanup = () => signal.removeEventListener('abort', cancel)

    signal.addEventListener('abort', cancel, { once: true })
    void operation.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error: unknown) => {
        cleanup()
        reject(error)
      },
    )
  })
}

const loadEngine = async (onStatus?: (status: LocalAiStatus) => void, signal?: AbortSignal) => {
  if (engine) {
    return engine
  }

  onStatus?.({ stage: 'downloading', detail: `Preparing ${LOCAL_MODEL_ID} on this device…`, progress: 0 })
  const webllm = await awaitWithCancellation(loadWebLlm(), signal)
  throwIfCancelled(signal)
  worker ??= new Worker(new URL('../../workers/localAi.worker.ts', import.meta.url), { type: 'module' })
  const loadedEngine = await awaitWithCancellation(
    webllm.CreateWebWorkerMLCEngine(worker, LOCAL_MODEL_ID, {
      initProgressCallback: (report) => {
        onStatus?.({
          stage: 'downloading',
          detail: report.text,
          progress: Math.round(report.progress * 100),
        })
      },
    }),
    signal,
  )
  throwIfCancelled(signal)
  engine = loadedEngine
  onStatus?.({ stage: 'ready', detail: `${LOCAL_MODEL_ID} is ready on this device.` })
  return engine
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
    if (signal?.aborted || error instanceof LocalGenerationCancelledError) {
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
      throw reportUnsupported(
        request,
        new LocalGenerationUnsupportedError(
          'WebGPU is available in this browser, but it found no compatible GPU. Update your graphics drivers or browser, or author cards manually.',
        ),
      )
    }

    const activeEngine = await loadEngine(request.onStatus, request.signal)
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
      const completion = await awaitWithCancellation(
        createCompletion(
          activeEngine,
          {
            messages: [
              {
                role: 'system',
                content:
                  'You create precise study cards using only the provided source text and return valid JSON.',
              },
              { role: 'user', content: buildLocalGenerationPrompt(request.chunks, requestedCount) },
            ],
            temperature: 0.15,
            max_tokens: 1_200,
          },
          request.signal,
        ),
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
