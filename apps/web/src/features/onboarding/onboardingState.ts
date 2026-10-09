/**
 * Onboarding persistence for the Rokki welcome flow.
 *
 * The flow runs once per device. Completion and the learner's chosen
 * generation mode are stored in `localStorage` so a returning learner lands
 * directly on the home dashboard. Nothing here leaves the device, consistent
 * with the Local Private boundary in the PRD.
 */

export const ONBOARDING_STORAGE_KEY = 'traccoon.onboarding.v1'

/**
 * The generation mode a learner selects on the "Getting started" screen.
 *
 * - `local-private` is the recommended, fully offline-capable default.
 * - `cloud-enhanced` is a deferred post-hackathon path. The flow records the
 *   learner's interest but the app never simulates a successful sign-in.
 */
export type OnboardingMode = 'local-private' | 'cloud-enhanced'

export interface OnboardingState {
  /** True once the learner finishes or skips the welcome flow. */
  completed: boolean
  /** The learner's preferred generation mode. */
  mode: OnboardingMode
  /** ISO timestamp of the last state write, for diagnostics. */
  updatedAt: string
}

export const defaultOnboardingState: OnboardingState = {
  completed: false,
  mode: 'local-private',
  updatedAt: '',
}

const isOnboardingMode = (value: unknown): value is OnboardingMode =>
  value === 'local-private' || value === 'cloud-enhanced'

/**
 * Parse a stored JSON string into a validated {@link OnboardingState}.
 *
 * Unknown, partial, or corrupt values fall back to
 * {@link defaultOnboardingState} so a bad write never traps a learner on a
 * blank screen.
 */
export function parseOnboardingState(raw: string | null): OnboardingState {
  if (!raw) {
    return defaultOnboardingState
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      completed: parsed.completed === true,
      mode: isOnboardingMode(parsed.mode) ? parsed.mode : defaultOnboardingState.mode,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return defaultOnboardingState
  }
}

const safeStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage
  } catch {
    // Accessing localStorage can throw in sandboxed or privacy contexts.
    return undefined
  }
}

/** Read the current onboarding state. Defaults when storage is unavailable. */
export function readOnboardingState(): OnboardingState {
  const storage = safeStorage()
  if (!storage) {
    return defaultOnboardingState
  }
  try {
    return parseOnboardingState(storage.getItem(ONBOARDING_STORAGE_KEY))
  } catch {
    return defaultOnboardingState
  }
}

/**
 * Persist a partial onboarding update, merged over the current state. Returns
 * the written state. A storage failure is swallowed so the UI keeps working;
 * the flow simply shows again on the next visit.
 */
export function writeOnboardingState(update: Partial<Omit<OnboardingState, 'updatedAt'>>): OnboardingState {
  const current = readOnboardingState()
  const next: OnboardingState = {
    completed: update.completed ?? current.completed,
    mode: update.mode ?? current.mode,
    updatedAt: new Date().toISOString(),
  }

  const storage = safeStorage()
  if (storage) {
    try {
      storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore quota or privacy-mode write failures.
    }
  }

  return next
}

/** Clear stored onboarding state so the flow runs again. */
export function resetOnboardingState(): void {
  const storage = safeStorage()
  if (!storage) {
    return
  }
  try {
    storage.removeItem(ONBOARDING_STORAGE_KEY)
  } catch {
    // Ignore.
  }
}
