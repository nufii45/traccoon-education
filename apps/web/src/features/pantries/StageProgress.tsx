import { GENERATION_STAGES, STAGE_COUNT, type GenerationView } from './generationStages'
import styles from './StageProgress.module.css'

/**
 * The five-segment generation progress indicator. Segments reflect the real
 * pipeline state in {@link GenerationView}: completed stages stay filled, the
 * active stage pulses, pending stages are muted, and a failed stage stops the
 * run instead of showing full completion. The stage counter reports the active
 * stage number, never an estimated percentage, because the stages do not take
 * equal time.
 */
export function StageProgress({ view }: { view: GenerationView }) {
  // The active stage shown in "N of 5"; once complete it reads as 5 of 5.
  const counterValue =
    view.phase === 'completed'
      ? STAGE_COUNT
      : view.phase === 'failed'
        ? view.activeStageIndex + 1
        : Math.min(view.activeStageIndex + 1, STAGE_COUNT)

  return (
    <div className={styles.wrapper}>
      <div className={styles.counterRow}>
        <span className={styles.counter}>
          {view.phase === 'failed' ? 'Stopped at' : 'Step'} {counterValue} of {STAGE_COUNT}
        </span>
      </div>
      <div
        aria-hidden="true"
        className={styles.track}
        data-phase={view.phase}
      >
        {view.segments.map((segmentState, index) => (
          <span
            className={styles.segment}
            data-state={segmentState}
            key={GENERATION_STAGES[index].id}
          />
        ))}
      </div>
      {/* The live message is announced by the Rokki status region above, so the
          detailed stage list is decorative here and hidden from the tree. */}
      <ol aria-hidden="true" className={styles.legend}>
        {GENERATION_STAGES.map((stage, index) => (
          <li className={styles.legendItem} data-state={view.segments[index]} key={stage.id}>
            {stage.label}
          </li>
        ))}
      </ol>
    </div>
  )
}
