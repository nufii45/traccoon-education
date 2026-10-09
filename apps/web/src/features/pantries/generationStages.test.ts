import { describe, expect, it } from 'vitest'
import type { LocalAiStatus } from '../local-ai/localAiClient'
import {
  compactModelStatus,
  deriveGenerationView,
  GENERATION_STAGES,
  isGenerationBusy,
  STAGE_COUNT,
} from './generationStages'

const status = (value: LocalAiStatus) => value

describe('deriveGenerationView', () => {
  it('stays idle with no active segments before generation starts', () => {
    const view = deriveGenerationView(status({ stage: 'idle', detail: 'Ready when you are.' }), false)

    expect(view.phase).toBe('idle')
    expect(view.isWorking).toBe(false)
    expect(view.isComplete).toBe(false)
    expect(view.segments).toEqual(['pending', 'pending', 'pending', 'pending', 'pending'])
  })

  it('maps checking and downloading to the first reading stage', () => {
    for (const raw of [
      status({ stage: 'checking', detail: 'Checking WebGPU…' }),
      status({ stage: 'downloading', detail: 'Fetching', progress: 40 }),
    ]) {
      const view = deriveGenerationView(raw, false)
      expect(view.activeStageIndex).toBe(0)
      expect(view.phase).toBe('preparing')
      expect(view.segments[0]).toBe('active')
      expect(view.message).toBe(GENERATION_STAGES[0].message)
      expect(view.isWorking).toBe(true)
    }
  })

  it('maps model ready to the key-concept stage with the first segment completed', () => {
    const view = deriveGenerationView(status({ stage: 'ready', detail: 'Model ready' }), false)

    expect(view.activeStageIndex).toBe(1)
    expect(view.segments).toEqual(['completed', 'active', 'pending', 'pending', 'pending'])
    expect(view.message).toBe(GENERATION_STAGES[1].message)
  })

  it('maps generating to the questions stage', () => {
    const view = deriveGenerationView(status({ stage: 'generating', detail: 'Generating' }), false)

    expect(view.activeStageIndex).toBe(2)
    expect(view.segments).toEqual(['completed', 'completed', 'active', 'pending', 'pending'])
  })

  it('keeps the later stages pending through generation until cards arrive', () => {
    // The committed generator verifies and prepares cards inside the
    // generating burst without a separate status, so those stages stay pending
    // until review-ready cards actually exist.
    const view = deriveGenerationView(status({ stage: 'generating', detail: 'Generating' }), false)

    expect(view.segments[3]).toBe('pending')
    expect(view.segments[4]).toBe('pending')
  })

  it('only completes every stage once review-ready cards exist', () => {
    // A terminal ready status without cards must not fill the last segment.
    const withoutCards = deriveGenerationView(status({ stage: 'ready', detail: 'passed source checks' }), false)
    expect(withoutCards.isComplete).toBe(false)
    expect(withoutCards.phase).not.toBe('completed')
    expect(withoutCards.segments[STAGE_COUNT - 1]).not.toBe('completed')
    expect(withoutCards.segments.filter((s) => s === 'completed').length).toBeLessThan(STAGE_COUNT)

    const withCards = deriveGenerationView(status({ stage: 'ready', detail: 'passed source checks' }), true)
    expect(withCards.phase).toBe('completed')
    expect(withCards.isComplete).toBe(true)
    expect(withCards.activeStageIndex).toBe(STAGE_COUNT)
    expect(withCards.segments).toEqual(Array(STAGE_COUNT).fill('completed'))
    expect(withCards.message).toBe('Your study cards are ready!')
  })

  it('marks the stage it failed on without claiming full completion', () => {
    const view = deriveGenerationView(status({ stage: 'error', detail: 'Rokki could not finish your cards.' }), false)

    expect(view.phase).toBe('failed')
    expect(view.isWorking).toBe(false)
    expect(view.segments).not.toContain('completed')
    expect(view.segments[0]).toBe('failed')
    expect(view.message).toBe('Rokki could not finish your cards.')
  })

  it('treats unsupported and cancelled as non-working stop states', () => {
    const unsupported = deriveGenerationView(status({ stage: 'unsupported', detail: 'No WebGPU' }), false)
    expect(unsupported.phase).toBe('unsupported')
    expect(unsupported.isWorking).toBe(false)

    const cancelled = deriveGenerationView(status({ stage: 'cancelled', detail: 'Cancelled' }), false)
    expect(cancelled.phase).toBe('cancelled')
    expect(cancelled.isWorking).toBe(false)
  })
})

describe('isGenerationBusy', () => {
  it.each(['checking', 'downloading', 'ready', 'generating'] as const)('is busy while %s', (stage) => {
    expect(isGenerationBusy({ stage, detail: '' } as LocalAiStatus)).toBe(true)
  })

  it.each(['idle', 'error', 'cancelled', 'unsupported'] as const)('is not busy while %s', (stage) => {
    expect(isGenerationBusy({ stage, detail: '' } as LocalAiStatus)).toBe(false)
  })
})

describe('compactModelStatus', () => {
  it('reports a device compatibility issue when WebGPU is unavailable', () => {
    const result = compactModelStatus(status({ stage: 'idle', detail: '' }), { webGpu: 'unavailable' })
    expect(result).toEqual({ message: 'Device compatibility issue', tone: 'error', offlineReady: false })
  })

  it('reports the model unavailable on a hard error', () => {
    const result = compactModelStatus(status({ stage: 'error', detail: '' }), { webGpu: 'available' })
    expect(result.message).toBe('AI model unavailable')
    expect(result.tone).toBe('error')
  })

  it('says preparing offline AI while downloading', () => {
    const result = compactModelStatus(status({ stage: 'downloading', detail: '', progress: 10 }), { webGpu: 'available' })
    expect(result.message).toBe('Preparing offline AI')
  })

  it('says starting the model while checking', () => {
    const result = compactModelStatus(status({ stage: 'checking', detail: '' }), { webGpu: 'available' })
    expect(result.message).toBe('Starting AI model')
  })

  it('is ready and offline-capable once the model is loaded and files are cached', () => {
    const result = compactModelStatus(status({ stage: 'ready', detail: '' }), { webGpu: 'available', cache: 'cached' })
    expect(result.message).toBe('Ready to generate')
    expect(result.tone).toBe('ok')
    expect(result.offlineReady).toBe(true)
  })

  it('is ready without the offline label when the loaded files are not confirmed cached', () => {
    const result = compactModelStatus(status({ stage: 'ready', detail: '' }), { webGpu: 'available', cache: 'not-cached' })
    expect(result.message).toBe('Ready to generate')
    expect(result.offlineReady).toBe(false)
  })

  it('does not claim offline ready just because WebGPU is supported', () => {
    const result = compactModelStatus(status({ stage: 'idle', detail: '' }), { webGpu: 'available', cache: 'not-cached' })
    expect(result.message).toBe('Offline AI needs preparing')
    expect(result.offlineReady).toBe(false)
  })

  it('reports ready and offline when cached before loading this session', () => {
    const result = compactModelStatus(status({ stage: 'idle', detail: '' }), { webGpu: 'available', cache: 'cached' })
    expect(result.message).toBe('Ready to generate')
    expect(result.offlineReady).toBe(true)
  })
})
