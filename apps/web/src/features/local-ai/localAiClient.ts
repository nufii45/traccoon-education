import { buildLocalGenerationPrompt, parseModelCards } from './localGenerator'
import { MAX_CARDS_PER_RUN, MAX_REGENERATION_RETRIES } from './policy'
import type { GeneratedCard, SourceChunk, SourcePage } from './types'
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'

export const LOCAL_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'

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

export class LocalGenerationCancelledError extends Error {
  constructor() {
    super('Local generation was cancelled.')
    this.name = 'LocalGenerationCancelledError'
  }
}

export class LocalGenerationUnsupportedError extends Error {
  constructor() {
    super('WebGPU is unavailable in this browser. Use Chrome or Edge on the demo Mac, or author cards manually.')
    this.name = 'LocalGenerationUnsupportedError'
  }
}

export class LocalGenerationOutputError extends Error {
  constructor() {
    super('The local model could not produce source-verified cards. Try a smaller selection or author a card manually.')
    this.name = 'LocalGenerationOutputError'
  }
}

const throwIfCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new LocalGenerationCancelledError()
  }
}

const loadEngine = async (onStatus?: (status: LocalAiStatus) => void) => {
  if (engine) {
    return engine
  }

  onStatus?.({ stage: 'downloading', detail: `Preparing ${LOCAL_MODEL_ID} on this device…`, progress: 0 })
  const webllm = await import('@mlc-ai/web-llm')
  worker ??= new Worker(new URL('../../workers/localAi.worker.ts', import.meta.url), { type: 'module' })
  engine = await webllm.CreateWebWorkerMLCEngine(worker, LOCAL_MODEL_ID, {
    initProgressCallback: (report) => {
      onStatus?.({
        stage: 'downloading',
        detail: report.text,
        progress: Math.round(report.progress * 100),
      })
    },
  })
  onStatus?.({ stage: 'ready', detail: `${LOCAL_MODEL_ID} is ready on this device.` })
  return engine
}

export const generateCardsLocally = async (
  request: LocalGenerationRequest,
): Promise<LocalGenerationResult> => {
  const requestedCount = Math.min(request.requestedCount ?? MAX_CARDS_PER_RUN, MAX_CARDS_PER_RUN)
  const cancel = () => {
    void cancelLocalGeneration()
  }

  request.signal?.addEventListener('abort', cancel, { once: true })
  request.onStatus?.({ stage: 'checking', detail: 'Checking this browser for WebGPU…' })

  try {
    throwIfCancelled(request.signal)
    const webGpu = (navigator as Navigator & { gpu?: unknown }).gpu
    if (!webGpu) {
      const error = new LocalGenerationUnsupportedError()
      request.onStatus?.({ stage: 'unsupported', detail: error.message })
      throw error
    }

    const activeEngine = await loadEngine(request.onStatus)
    throwIfCancelled(request.signal)
    for (let attempt = 0; attempt <= MAX_REGENERATION_RETRIES; attempt += 1) {
      request.onStatus?.({
        stage: 'generating',
        detail: attempt === 0
          ? 'Generating cards locally in your browser…'
          : `Checking another local response (${attempt + 1} of ${MAX_REGENERATION_RETRIES + 1})…`,
      })
      const completion = await activeEngine.chat.completions.create({
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
      })
      throwIfCancelled(request.signal)
      const content = String(completion.choices[0]?.message.content ?? '')
      const cards = parseModelCards(content, request.sourcePages).slice(0, requestedCount)

      if (cards.length > 0) {
        request.onStatus?.({ stage: 'ready', detail: 'Cards were generated locally and passed source checks.' })
        return { cards, method: 'webllm' }
      }
    }

    throw new LocalGenerationOutputError()
  } catch (error) {
    if (error instanceof LocalGenerationCancelledError || request.signal?.aborted) {
      request.onStatus?.({ stage: 'cancelled', detail: 'Local generation was cancelled. Your source stayed unchanged.' })
      throw new LocalGenerationCancelledError()
    }
    const detail = error instanceof Error ? error.message : 'The local model could not start.'
    request.onStatus?.({ stage: 'error', detail })
    throw error
  } finally {
    request.signal?.removeEventListener('abort', cancel)
  }
}

export const cancelLocalGeneration = async () => {
  if (engine) {
    engine.interruptGenerate()
    return
  }

  worker?.terminate()
  worker = undefined
}

export const releaseLocalModel = async () => {
  await engine?.unload()
  worker?.terminate()
  worker = undefined
  engine = undefined
}
