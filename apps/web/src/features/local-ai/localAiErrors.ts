// Turns whatever the local model stack throws into one short sentence a
// learner can act on.
//
// web-llm runs in a worker and its worker handler rejects with
// `err.toString()`, so the main thread usually receives a plain string such as
// "ShaderF16SupportError: ..." instead of an Error. A worker that fails to load
// surfaces as an Event. Messages built here carry engine diagnostics only,
// never study content.

export type LocalAiFailurePhase = 'start' | 'run'

export interface LocalAiFailure {
  // One learner-readable message, with a short technical detail when useful.
  message: string
  // The worker, engine, or GPU device is unusable; the next attempt needs a fresh worker.
  resetEngine: boolean
  // The half-precision build failed in a way the full-precision build may avoid.
  tryCompatibilityModel: boolean
  // This browser or GPU cannot run the model at all.
  unsupported: boolean
}

interface FailureRule {
  pattern: RegExp
  summary: (context: { offline: boolean }) => string
  // Append the engine's own wording; skipped where it would only add noise.
  detail?: boolean
  resetEngine?: boolean
  tryCompatibilityModel?: boolean
  unsupported?: boolean
}

const MAX_DETAIL_CHARS = 160

// Order matters: the first matching rule wins, so specific causes come before
// the broad download rule.
const FAILURE_RULES: FailureRule[] = [
  {
    // A stale tab asking for hashed files a newer deploy replaced, or a worker
    // script that never loaded.
    pattern: /dynamically imported module|importing a module script failed|ChunkLoadError|worker could not be loaded/i,
    summary: () => 'The files for the local model could not be loaded. Reload the page, then try again.',
    resetEngine: true,
  },
  {
    pattern: /ContextWindowSizeExceededError|context window/i,
    summary: () => 'The selected pages are too long for the local model. Choose fewer or shorter pages, then try again.',
  },
  {
    pattern: /WebGPUNotAvailableError|WebGPUNotFoundError|Cannot find WebGPU|Unable to find a compatible GPU|Cannot initialize runtime because|requestAdapter|requestDevice/i,
    summary: () => 'This browser could not start WebGPU for the local model. Update your browser or graphics drivers, or author cards manually.',
    detail: true,
    unsupported: true,
  },
  {
    pattern: /DeviceLostError|device was lost|device lost|out of memory|insufficient memory|GPUOutOfMemoryError|allocation failed|Failed to allocate/i,
    summary: () => 'The GPU stopped while running the model, usually because it ran out of memory. Close other tabs that use the GPU, then try again.',
    resetEngine: true,
  },
  {
    pattern: /EngineNotLoadedError|ModelNotLoadedError|WorkerEngineModelNotLoadedError|not (?:been )?loaded/i,
    summary: () => 'The local model was unloaded. Try again to reload it.',
    resetEngine: true,
  },
  {
    pattern: /QuotaExceededError|quota|no space left|disk full/i,
    summary: () => 'There is not enough free storage to keep the local model (about 1 GB). Free some space, then try again.',
  },
  {
    pattern: /failed to fetch|network ?error|network request failed|load failed|ERR_[A-Z_]+|Cannot fetch|Unable to fetch|received status|request failed|caches is not defined|CacheStorage|Failed to execute '(?:add|addAll|put|match|open)' on 'Cache/i,
    summary: ({ offline }) =>
      offline
        ? 'You are offline and the local model is not saved on this device yet. Connect once to download it, then try again.'
        : 'The local model files could not be downloaded or saved. Check your connection and free storage, then try again.',
    detail: true,
  },
  {
    // Half-precision shaders the GPU or driver cannot compile. The
    // full-precision build of the same model may still run.
    pattern: /ShaderF16SupportError|shader-f16|\bf16\b|WGSL|GPUPipelineError|createComputePipeline|createShaderModule|shader module|compilation (?:error|failed)/i,
    summary: () => 'This GPU could not compile the local model. Author cards manually instead.',
    detail: true,
    tryCompatibilityModel: true,
    unsupported: true,
  },
]

const rawFailureText = (error: unknown): string => {
  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null) {
    const { name, message, type } = error as { name?: unknown; message?: unknown; type?: unknown }
    const label = typeof name === 'string' && name !== 'Error' ? name : ''
    const text = typeof message === 'string' ? message : ''
    if (label || text) {
      return label && text ? `${label}: ${text}` : label || text
    }
    if (typeof type === 'string') {
      return `${type} event`
    }
  }

  return ''
}

const tidyDetail = (raw: string): string => {
  const flattened = raw.replace(/\s+/g, ' ').replace(/^(?:Uncaught\s+)?Error:\s*/i, '').trim()
  return flattened.length > MAX_DETAIL_CHARS ? `${flattened.slice(0, MAX_DETAIL_CHARS - 1).trimEnd()}…` : flattened
}

const withDetail = (summary: string, detail: string): string => (detail ? `${summary} Details: ${detail}` : summary)

export const classifyLocalAiFailure = (error: unknown, phase: LocalAiFailurePhase): LocalAiFailure => {
  const raw = rawFailureText(error)
  const detail = tidyDetail(raw)
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const rule = FAILURE_RULES.find(({ pattern }) => pattern.test(raw))

  if (rule) {
    return {
      message: rule.detail ? withDetail(rule.summary({ offline }), detail) : rule.summary({ offline }),
      resetEngine: rule.resetEngine ?? false,
      tryCompatibilityModel: rule.tryCompatibilityModel ?? false,
      unsupported: rule.unsupported ?? false,
    }
  }

  const summary =
    phase === 'start'
      ? 'The local model could not start. Try again, or author cards manually.'
      : 'The local model stopped before finishing. Try again, or author cards manually.'

  return {
    message: withDetail(summary, detail),
    // An unknown failure while starting may have left a half-initialised
    // engine behind, so the next attempt starts from a clean worker.
    resetEngine: phase === 'start',
    tryCompatibilityModel: false,
    unsupported: false,
  }
}
