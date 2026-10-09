import type { LocalAiStatus } from '../local-ai/localAiClient'

/**
 * The five student-facing generation stages. These map onto the real
 * operations the local generator already reports through `onStatus`; they are
 * never advanced by a timer. The order is the order the pipeline runs them in.
 */
export const GENERATION_STAGES = [
  { id: 'reading', label: 'Reading source pages', message: 'Reading your selected pages…' },
  { id: 'concepts', label: 'Identifying key concepts', message: 'Finding important ideas…' },
  { id: 'questions', label: 'Generating questions', message: 'Creating your study questions…' },
  { id: 'verifying', label: 'Verifying source references', message: 'Checking questions against your pages…' },
  { id: 'preparing', label: 'Preparing review cards', message: 'Preparing your review cards…' },
] as const

export type GenerationStageId = (typeof GENERATION_STAGES)[number]['id']

export const STAGE_COUNT = GENERATION_STAGES.length

export type SegmentState = 'pending' | 'active' | 'completed' | 'failed'

/**
 * The merged Step 02 generation state machine. It is derived from the real
 * `LocalAiStatus` plus whether review-ready cards have arrived, so the UI can
 * never show progress the pipeline has not actually reached.
 */
export type GenerationPhase =
  | 'idle'
  | 'preparing'
  | 'generating'
  | 'verifying'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'unsupported'
  | 'cancelled'

export interface GenerationView {
  phase: GenerationPhase
  /** The 0-based index of the active stage, or STAGE_COUNT when every stage is done. */
  activeStageIndex: number
  /** Per-segment state for the five-segment indicator. */
  segments: SegmentState[]
  /** The dynamic status line shown under the Rokki heading. */
  message: string
  /** True while the pipeline is actively working (mascot spinner animates). */
  isWorking: boolean
  /** True once review-ready cards exist and the success transition can run. */
  isComplete: boolean
}

/** Which stage index the raw status currently sits on, before completion is applied. */
const stageIndexForStatus = (status: LocalAiStatus): number => {
  switch (status.stage) {
    // Browser check and model download both belong to "reading / getting ready".
    case 'checking':
    case 'downloading':
      return 0
    // The model is loaded and the prompt is being built: key-concept phase.
    case 'ready':
      return 1
    case 'generating':
      return 2
    case 'verifying':
      return 3
    default:
      return 0
  }
}

const phaseForStatus = (status: LocalAiStatus): GenerationPhase => {
  switch (status.stage) {
    case 'checking':
    case 'downloading':
    case 'ready':
      return 'preparing'
    case 'generating':
      return 'generating'
    case 'verifying':
      return 'verifying'
    case 'unsupported':
      return 'unsupported'
    case 'cancelled':
      return 'cancelled'
    case 'error':
      return 'failed'
    default:
      return 'idle'
  }
}

const buildSegments = (activeIndex: number, phase: GenerationPhase): SegmentState[] =>
  GENERATION_STAGES.map((_stage, index) => {
    if (phase === 'completed') {
      return 'completed'
    }
    if (phase === 'failed') {
      // Everything before the failure stays done; the stage it died on reads as failed.
      if (index < activeIndex) return 'completed'
      if (index === activeIndex) return 'failed'
      return 'pending'
    }
    if (index < activeIndex) return 'completed'
    if (index === activeIndex) return 'active'
    return 'pending'
  })

/**
 * Derive the five-stage view from the real generator status and whether
 * review-ready cards have arrived.
 *
 * `hasCards` is only true once validated cards are in hand, so the final
 * "Preparing review cards" stage cannot complete before the cards actually
 * exist. A terminal `ready` status without cards means a run finished with no
 * valid cards and is treated as a failure the learner can retry.
 */
export const deriveGenerationView = (status: LocalAiStatus, hasCards: boolean): GenerationView => {
  // Review-ready cards are in hand: all five segments fill and the success
  // transition can run, regardless of the last raw status.
  if (hasCards) {
    return {
      phase: 'completed',
      activeStageIndex: STAGE_COUNT,
      segments: buildSegments(STAGE_COUNT, 'completed'),
      message: 'Your study cards are ready!',
      isWorking: false,
      isComplete: true,
    }
  }

  const phase = phaseForStatus(status)

  if (phase === 'idle') {
    return {
      phase,
      activeStageIndex: 0,
      segments: buildSegments(-1, 'idle'),
      message: '',
      isWorking: false,
      isComplete: false,
    }
  }

  if (phase === 'failed' || phase === 'unsupported' || phase === 'cancelled') {
    // The stage it stopped on, so completed stages stay filled and the current
    // one reads as failed instead of falsely full.
    const stoppedAt = stageIndexForStatus(status)
    return {
      phase,
      activeStageIndex: stoppedAt,
      segments: buildSegments(stoppedAt, 'failed'),
      message: status.detail,
      isWorking: false,
      isComplete: false,
    }
  }

  const activeStageIndex = stageIndexForStatus(status)
  return {
    phase,
    activeStageIndex,
    segments: buildSegments(activeStageIndex, phase),
    message: GENERATION_STAGES[activeStageIndex].message,
    isWorking: true,
    isComplete: false,
  }
}

/** True while the generator is doing real work and duplicate submits must be blocked. */
export const isGenerationBusy = (status: LocalAiStatus): boolean =>
  status.stage === 'checking'
  || status.stage === 'downloading'
  || status.stage === 'ready'
  || status.stage === 'generating'
  || status.stage === 'verifying'

export type ModelStatusTone = 'ok' | 'info' | 'pending' | 'error'

export interface CompactModelStatus {
  message: string
  tone: ModelStatusTone
  /** Secondary offline-readiness label, only when it is actually true. */
  offlineReady: boolean
}

/**
 * The compact, student-facing model status row. Wording reflects the real
 * runtime state and never claims "Ready" or "Offline ready" before it is true.
 */
export const compactModelStatus = (
  status: LocalAiStatus,
  readiness: { webGpu?: 'available' | 'unavailable'; cache?: 'cached' | 'not-cached' | 'unknown' },
): CompactModelStatus => {
  if (status.stage === 'unsupported' || readiness.webGpu === 'unavailable') {
    return { message: 'Device compatibility issue', tone: 'error', offlineReady: false }
  }
  if (status.stage === 'error') {
    return { message: 'AI model unavailable', tone: 'error', offlineReady: false }
  }
  if (status.stage === 'downloading') {
    return { message: 'Preparing offline AI', tone: 'info', offlineReady: false }
  }
  if (status.stage === 'checking') {
    return { message: 'Starting AI model', tone: 'pending', offlineReady: false }
  }

  // Not actively loading. The model is operational the moment it has loaded in
  // this session (ready/generating/verifying), otherwise readiness depends on
  // the cached files being present and WebGPU being available.
  const loadedThisSession = status.stage === 'ready' || status.stage === 'generating' || status.stage === 'verifying'
  const cachedOffline = readiness.webGpu === 'available' && readiness.cache === 'cached'

  if (loadedThisSession) {
    return { message: 'Ready to generate', tone: 'ok', offlineReady: cachedOffline }
  }
  if (cachedOffline) {
    return { message: 'Ready to generate', tone: 'ok', offlineReady: true }
  }
  // WebGPU present but model not cached yet: honest "will prepare on first run".
  return { message: 'Offline AI needs preparing', tone: 'info', offlineReady: false }
}
