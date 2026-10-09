import {
  Add01Icon,
  ArrowRight02Icon,
  FileUploadIcon,
  SquareLock02Icon,
} from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import { InteractiveRokki } from '../../components/InteractiveRokki'
import rokkiChoice from '../../assets/rokki/rokki-choice.webp'
import rokkiWelcome from '../../assets/rokki/rokki-welcome.webp'
import type { PantrySummary } from '../pantries/repository'
import type { OnboardingMode } from './onboardingState'
import styles from './HomeDashboard.module.css'

interface HomeDashboardProps {
  /** Pantry summaries from the local repository. */
  pantries: PantrySummary[]
  /** The learner's chosen generation mode, shown as an honest status chip. */
  mode: OnboardingMode
  /** Start the PDF import flow (existing ImportWorkspace). */
  onCreateFromPdf: () => void
  /** Start the manual authoring flow (existing ManualPantryStarter). */
  onCreateManually: () => void
  /** Open an existing pantry. */
  onOpenPantry: (id: string) => void
  /** Re-open the welcome flow. */
  onReplayIntro: () => void
}

/**
 * The home dashboard — screen five of onboarding and the app's landing view
 * once the flow is complete. It greets the learner with Rokki, shows the
 * empty-pantry state on a fresh device, and offers the two real creation
 * paths wired to the existing workflows.
 */
export function HomeDashboard({
  pantries,
  mode,
  onCreateFromPdf,
  onCreateManually,
  onOpenPantry,
  onReplayIntro,
}: HomeDashboardProps) {
  const isEmpty = pantries.length === 0

  return (
    <section aria-label="Home dashboard" className={styles.dashboard}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />{' '}
            {mode === 'cloud-enhanced' ? 'Local Private (cloud coming soon)' : 'Local Private mode'}
          </p>
          <h1 className={styles.title}>
            Welcome back. <em>What are we studying?</em>
          </h1>
          <p className={styles.lede}>
            Meet Rokki, your learning companion. From making study cards to celebrating your
            progress, Rokki is here to make learning a little more fun — and your material and
            progress stay on this device.
          </p>
          <p className={styles.modeChip}>
            <Icon icon={SquareLock02Icon} size={16} /> No account required
          </p>
        </div>
        <div className={styles.rokki}>
          <InteractiveRokki
            actionLabel="Say hello to Rokki, then start a new study set"
            imageAlt="Rokki welcomes you back"
            onActivate={onCreateFromPdf}
            src={rokkiWelcome}
            width={200}
          />
        </div>
      </header>

      <div className={styles.actions}>
        <button className={styles.actionCard} onClick={onCreateFromPdf} type="button">
          <span className={styles.actionIcon}>
            <Icon icon={FileUploadIcon} size={32} />
          </span>
          <span className={styles.actionBody}>
            <span className={styles.actionTitle}>Create from a PDF</span>
            <span className={styles.actionCopy}>
              Pick a text-based PDF, select one to three pages, and let Rokki draft reviewable
              cards locally.
            </span>
          </span>
          <span className={styles.actionArrow} aria-hidden="true">
            <Icon icon={ArrowRight02Icon} />
          </span>
        </button>

        <button className={styles.actionCard} onClick={onCreateManually} type="button">
          <span className={styles.actionIcon}>
            <Icon icon={Add01Icon} size={32} />
          </span>
          <span className={styles.actionBody}>
            <span className={styles.actionTitle}>Create manually</span>
            <span className={styles.actionCopy}>
              Already know what to practice? Author a small, evidence-linked set by hand — no model
              needed.
            </span>
          </span>
          <span className={styles.actionArrow} aria-hidden="true">
            <Icon icon={ArrowRight02Icon} />
          </span>
        </button>
      </div>

      <section aria-label="Your pantries" className={styles.pantrySection}>
        <div className={styles.sectionHeading}>
          <h2>Your pantries</h2>
          <button className={styles.replay} onClick={onReplayIntro} type="button">
            Replay intro
          </button>
        </div>

        {isEmpty ? (
          <div className={styles.emptyState}>
            <InteractiveRokki
              actionLabel="Rokki is ready — create your first study set"
              className={styles.emptyMark}
              imageAlt="Rokki is ready to help choose a study path"
              onActivate={onCreateFromPdf}
              src={rokkiChoice}
              width={120}
            />
            <div>
              <h3>Your pantry is empty — for now.</h3>
              <p>
                Rokki is hungry for a source. Create your first study set from a PDF or write one
                by hand to get started.
              </p>
              <div className={styles.emptyActions}>
                <button className={styles.primary} onClick={onCreateFromPdf} type="button">
                  <Icon icon={FileUploadIcon} /> Create from a PDF
                </button>
                <button className={styles.secondary} onClick={onCreateManually} type="button">
                  <Icon icon={Add01Icon} /> Create manually
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ul className={styles.pantryGrid}>
            {pantries.map((pantry) => (
              <li key={pantry.id}>
                <button className={styles.pantryCard} onClick={() => onOpenPantry(pantry.id)} type="button">
                  <span className={styles.pantryName}>{pantry.title}</span>
                  <span className={styles.pantryMeta}>
                    {pantry.cardCount} {pantry.cardCount === 1 ? 'card' : 'cards'} ·{' '}
                    {pantry.sourceName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
