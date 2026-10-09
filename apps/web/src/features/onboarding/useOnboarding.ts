import { useCallback, useState } from 'react'
import {
  readOnboardingState,
  resetOnboardingState,
  writeOnboardingState,
  type OnboardingMode,
  type OnboardingState,
} from './onboardingState'

export interface UseOnboarding {
  /** The current persisted onboarding state. */
  state: OnboardingState
  /** True when the learner has not yet finished or skipped the flow. */
  shouldShowOnboarding: boolean
  /** Record the learner's preferred generation mode. */
  setMode: (mode: OnboardingMode) => void
  /** Mark the flow complete, optionally storing the final chosen mode. */
  completeOnboarding: (mode?: OnboardingMode) => void
  /** Re-open the flow (used by a "Replay intro" affordance). */
  restartOnboarding: () => void
}

/**
 * React access to the device-local onboarding state. The initial read happens
 * once, lazily, so server-render or test environments without storage still
 * get a stable default.
 */
export function useOnboarding(): UseOnboarding {
  const [state, setState] = useState<OnboardingState>(() => readOnboardingState())

  const setMode = useCallback((mode: OnboardingMode) => {
    setState(writeOnboardingState({ mode }))
  }, [])

  const completeOnboarding = useCallback((mode?: OnboardingMode) => {
    setState(writeOnboardingState(mode ? { completed: true, mode } : { completed: true }))
  }, [])

  const restartOnboarding = useCallback(() => {
    resetOnboardingState()
    setState(writeOnboardingState({ completed: false }))
  }, [])

  return {
    state,
    shouldShowOnboarding: !state.completed,
    setMode,
    completeOnboarding,
    restartOnboarding,
  }
}
