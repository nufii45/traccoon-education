import { RokkiLoader } from '../../components/RokkiLoader/RokkiLoader'
import type { LocalAiStatus } from '../local-ai/localAiClient'
import type { GenerationView } from './generationStages'
import { StageProgress } from './StageProgress'
import styles from './GenerationExperience.module.css'

/**
 * The Rokki loading experience, shown inside the Step 02 container while cards
 * are generated. It keeps the existing mascot and spinner animating
 * independently of the segmented stage indicator, which tracks the real
 * pipeline. The live status line is the single announced region, so the
 * mascot and stage indicator stay silent to assistive technology.
 *
 * Only the model-download phase reports measurable progress; it is passed to
 * the mascot ring as a determinate value. Everything else is indeterminate.
 */
export function GenerationExperience({
  view,
  status,
}: {
  view: GenerationView
  status: LocalAiStatus
}) {
  const downloadProgress = status.stage === 'downloading' ? status.progress : undefined
  const isComplete = view.phase === 'completed'

  return (
    <div className={styles.stage} data-complete={isComplete ? 'true' : undefined}>
      <RokkiLoader
        announce={false}
        mode="generating"
        progress={downloadProgress}
        showLabel={false}
        size="md"
      />

      <div className={styles.copy}>
        <h3 className={styles.heading}>
          {isComplete ? 'Your study cards are ready!' : 'Rokki is making your cards!'}
        </h3>
        <p className={styles.subheading}>Turning your selected pages into questions you can review.</p>
        {/* The single live region for the whole experience: it announces each
            real stage change politely without re-reading the animation. When
            complete the heading conveys the result, so the line is cleared to
            avoid duplicate text. */}
        <p aria-live="polite" className={styles.statusMessage} role="status">
          {isComplete ? '' : view.message}
        </p>
      </div>

      <StageProgress view={view} />

      {!isComplete ? (
        <p className={styles.hint}>This may take a moment on your device.</p>
      ) : null}
    </div>
  )
}
