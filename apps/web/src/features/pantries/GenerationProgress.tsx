import type { LocalAiStatus } from '../local-ai/localAiClient'
import styles from './GenerationProgress.module.css'

type IndicatorState = 'working' | 'done'

const workingLabel = (status: LocalAiStatus) => {
  switch (status.stage) {
    case 'checking':
      return 'Checking this browser'
    case 'downloading':
      return status.progress === undefined ? 'Preparing the model' : `Downloading the model, ${status.progress}%`
    case 'generating':
      return 'Generating cards'
    default:
      return undefined
  }
}

/**
 * Generation status beside the Generate button: a spinner while the model
 * checks, downloads, or generates, which turns into a checkmark when cards
 * arrive. Other states (idle, unsupported, error, cancelled) show their
 * message as text so the learner knows what to do next.
 */
export function GenerationProgress({ status }: { status: LocalAiStatus }) {
  const label = status.stage === 'ready' ? 'Cards generated' : workingLabel(status)
  const indicatorState: IndicatorState | undefined = status.stage === 'ready' ? 'done' : label ? 'working' : undefined

  return (
    <span className={styles.status} role="status">
      {indicatorState ? (
        <>
          <svg aria-hidden="true" className={styles.indicator} data-state={indicatorState} focusable="false" viewBox="0 0 24 24">
            <circle className={styles.ring} cx="12" cy="12" r="10" />
            <path className={styles.check} d="M7.5 12.5l3 3 6-6.5" />
          </svg>
          <span className={styles.visuallyHidden}>{label}</span>
        </>
      ) : (
        <span className={styles.message}>{status.detail}</span>
      )}
    </span>
  )
}
