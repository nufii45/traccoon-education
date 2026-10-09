import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ONBOARDING_STORAGE_KEY,
  defaultOnboardingState,
  parseOnboardingState,
  readOnboardingState,
  resetOnboardingState,
  writeOnboardingState,
} from './onboardingState'

describe('onboarding state persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to an incomplete local-private flow when nothing is stored', () => {
    expect(readOnboardingState()).toEqual(defaultOnboardingState)
    expect(readOnboardingState().completed).toBe(false)
    expect(readOnboardingState().mode).toBe('local-private')
  })

  it('persists completion and the chosen mode across reads', () => {
    writeOnboardingState({ completed: true, mode: 'cloud-enhanced' })

    const stored = readOnboardingState()
    expect(stored.completed).toBe(true)
    expect(stored.mode).toBe('cloud-enhanced')
    expect(stored.updatedAt).not.toBe('')
  })

  it('merges partial updates over the existing state', () => {
    writeOnboardingState({ mode: 'cloud-enhanced' })
    writeOnboardingState({ completed: true })

    const stored = readOnboardingState()
    expect(stored).toMatchObject({ completed: true, mode: 'cloud-enhanced' })
  })

  it('resets stored state so the flow runs again', () => {
    writeOnboardingState({ completed: true })
    expect(readOnboardingState().completed).toBe(true)

    resetOnboardingState()
    expect(readOnboardingState().completed).toBe(false)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()
  })

  it('falls back to defaults for corrupt or unknown stored values', () => {
    expect(parseOnboardingState('not json')).toEqual(defaultOnboardingState)
    expect(parseOnboardingState('{"mode":"intergalactic"}')).toMatchObject({
      completed: false,
      mode: 'local-private',
    })
    expect(parseOnboardingState(null)).toEqual(defaultOnboardingState)
  })

  it('reads a persisted value through the raw storage key', () => {
    writeOnboardingState({ completed: true, mode: 'local-private' })
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(parseOnboardingState(raw).completed).toBe(true)
  })
})
