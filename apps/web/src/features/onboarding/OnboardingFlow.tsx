import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  CloudIcon,
  FileUploadIcon,
  SparklesIcon,
  SquareLock02Icon,
  WifiDisconnected02Icon,
} from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import rokkiMark from '../../assets/rokki-educ.webp'
import rokkiCards from '../../assets/rokki/rokki-cards.webp'
import rokkiChoice from '../../assets/rokki/rokki-choice.webp'
import rokkiOffline from '../../assets/rokki/rokki-offline.webp'
import rokkiPages from '../../assets/rokki/rokki-pages.webp'
import rokkiWelcome from '../../assets/rokki/rokki-welcome.webp'
import type { OnboardingMode } from './onboardingState'
import styles from './OnboardingFlow.module.css'

interface OnboardingFlowProps {
  /** Called when the learner finishes or skips, with their chosen mode. */
  onComplete: (mode: OnboardingMode) => void
  /** Persist the mode as the learner toggles it on the final teaching step. */
  onModeChange?: (mode: OnboardingMode) => void
  /** The initially selected generation mode. */
  initialMode?: OnboardingMode
}

type StepId = 'welcome' | 'how-it-works' | 'offline-first' | 'getting-started'

interface StepMeta {
  id: StepId
  /** Short label shown in the progress rail. */
  label: string
}

const STEPS: StepMeta[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'offline-first', label: 'Offline first' },
  { id: 'getting-started', label: 'Getting started' },
]

/**
 * The Rokki welcome flow: four desktop-first teaching screens that lead into
 * the home dashboard. Navigation is fully keyboard-accessible, honours
 * reduced-motion through CSS, and never blocks the learner from skipping.
 */
export function OnboardingFlow({ onComplete, onModeChange, initialMode = 'local-private' }: OnboardingFlowProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [mode, setMode] = useState<OnboardingMode>(initialMode)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const regionId = useId()

  const step = STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1

  // Move focus to each step heading so screen readers announce the new screen.
  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex])

  const goNext = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1))
  }, [])

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(current - 1, 0))
  }, [])

  const finish = useCallback(() => {
    onComplete(mode)
  }, [mode, onComplete])

  const chooseMode = useCallback(
    (next: OnboardingMode) => {
      setMode(next)
      onModeChange?.(next)
    },
    [onModeChange],
  )

  return (
    <div className={styles.flow}>
      <div className={styles.aurora} aria-hidden="true" />
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <img alt="" className={styles.brandMark} height="36" src={rokkiMark} width="36" />
          <span>
            traccoon <b>education</b>
          </span>
        </div>
        <button className={styles.skip} onClick={finish} type="button">
          Skip intro
        </button>
      </header>

      <main
        aria-label={`Onboarding: ${step.label}`}
        className={styles.stage}
        id={regionId}
        role="region"
      >
        {step.id === 'welcome' ? <WelcomeStep headingRef={headingRef} /> : null}
        {step.id === 'how-it-works' ? <HowItWorksStep headingRef={headingRef} /> : null}
        {step.id === 'offline-first' ? <OfflineFirstStep headingRef={headingRef} /> : null}
        {step.id === 'getting-started' ? (
          <GettingStartedStep headingRef={headingRef} mode={mode} onChooseMode={chooseMode} />
        ) : null}
      </main>

      <footer className={styles.controls}>
        <button
          className={styles.secondary}
          disabled={isFirst}
          onClick={goBack}
          type="button"
        >
          <Icon icon={ArrowLeft02Icon} /> Back
        </button>

        <ol aria-label="Progress" className={styles.progress}>
          {STEPS.map((meta, index) => (
            <li
              aria-current={index === stepIndex ? 'step' : undefined}
              className={index === stepIndex ? `${styles.dot} ${styles.dotActive}` : styles.dot}
              key={meta.id}
            >
              <span className={styles.srOnly}>
                {meta.label}
                {index === stepIndex ? ' (current step)' : ''}
              </span>
            </li>
          ))}
        </ol>

        {isLast ? (
          <button className={styles.primary} onClick={finish} type="button">
            Go to my dashboard <Icon icon={ArrowRight02Icon} />
          </button>
        ) : (
          <button className={styles.primary} onClick={goNext} type="button">
            Next <Icon icon={ArrowRight02Icon} />
          </button>
        )}
      </footer>
    </div>
  )
}

interface StepProps {
  headingRef: RefObject<HTMLHeadingElement | null>
}

function WelcomeStep({ headingRef }: StepProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} /> Local Private study studio
        </p>
        <h1 className={styles.display} ref={headingRef} tabIndex={-1}>
          Study what <em>actually matters.</em>
        </h1>
        <p className={styles.lede}>
          Traccoon turns a few pages of your own PDF into source-linked practice cards — on your
          laptop, without shipping your material to a server.
        </p>
        <ul className={styles.badges}>
          <li>
            <Icon icon={SquareLock02Icon} size={16} /> Private by default
          </li>
          <li>
            <Icon icon={SparklesIcon} size={16} /> AI you can check
          </li>
        </ul>
      </div>
      <figure className={styles.hero}>
        <img alt="Rokki welcomes you to Traccoon Education" src={rokkiWelcome} />
        <figcaption>Meet Rokki, your study companion.</figcaption>
      </figure>
    </section>
  )
}

function HowItWorksStep({ headingRef }: StepProps) {
  return (
    <section className={styles.panelWide}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} /> How it works
        </p>
        <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
          Three steps from PDF to practice.
        </h1>
        <p className={styles.lede}>
          You stay in control at every step, and every card points back to the exact page it came
          from.
        </p>
      </div>
      <ol className={styles.steps}>
        <li>
          <img alt="Rokki selecting useful PDF pages" className={styles.stepArtwork} src={rokkiPages} />
          <span className={styles.stepNumber}>01</span>
          <h2>Select PDF pages</h2>
          <p>Bring a text-based PDF and pick one to three pages. Nothing uploads.</p>
        </li>
        <li>
          <img alt="Rokki reviewing study cards" className={styles.stepArtwork} src={rokkiCards} />
          <span className={styles.stepNumber}>02</span>
          <h2>Review AI cards</h2>
          <p>Rokki drafts four-option cards. Keep, edit, or discard each one before it&apos;s saved.</p>
        </li>
        <li>
          <img alt="Rokki choosing a study path" className={styles.stepArtwork} src={rokkiChoice} />
          <span className={styles.stepNumber}>03</span>
          <h2>Study anywhere</h2>
          <p>Answer cards with instant feedback and open the source quote whenever you want.</p>
        </li>
      </ol>
    </section>
  )
}

function OfflineFirstStep({ headingRef }: StepProps) {
  return (
    <section className={styles.panelWide}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} /> Offline first
        </p>
        <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
          Generate online. Study offline.
        </h1>
        <p className={styles.lede}>
          Generating cards runs a model in your browser and may download assets the first time.
          Once your deck is saved, studying needs no connection at all.
        </p>
      </div>
      <div className={styles.offlineContent}>
        <figure className={styles.offlineArtwork}>
          <img alt="Rokki studying offline with a tablet" src={rokkiOffline} />
        </figure>
        <div className={styles.compareGrid}>
          <article className={styles.compareCard}>
            <span className={styles.compareIcon}>
              <Icon icon={SparklesIcon} size={24} />
            </span>
            <h2>Online generation</h2>
            <p>
              The on-device model may fetch its assets over the network the first time you generate.
              Your PDF text never leaves the browser for inference.
            </p>
          </article>
          <article className={`${styles.compareCard} ${styles.compareCardOffline}`}>
            <span className={styles.compareIcon}>
              <Icon icon={WifiDisconnected02Icon} size={24} />
            </span>
            <h2>Offline studying</h2>
            <p>
              Saved pantries, cards, and your answers live in this browser. Reload with the network
              off and keep studying.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

interface GettingStartedStepProps extends StepProps {
  mode: OnboardingMode
  onChooseMode: (mode: OnboardingMode) => void
}

function GettingStartedStep({ headingRef, mode, onChooseMode }: GettingStartedStepProps) {
  return (
    <section className={styles.panelWide}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} /> Getting started
        </p>
        <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
          Pick how Rokki generates cards.
        </h1>
        <p className={styles.lede}>
          Local mode is recommended and ready today. Cloud sign-in is coming after the hackathon —
          we won&apos;t pretend it works before it does.
        </p>
      </div>
      <div className={styles.gettingStartedContent}>
        <figure className={styles.choiceArtwork}>
          <img alt="Rokki ready to help you choose a study mode" src={rokkiChoice} />
        </figure>
        <fieldset className={styles.modeChoice}>
          <legend className={styles.srOnly}>Generation mode</legend>
          <label className={mode === 'local-private' ? `${styles.modeCard} ${styles.modeCardActive}` : styles.modeCard}>
            <input
              checked={mode === 'local-private'}
              name="onboarding-mode"
              onChange={() => onChooseMode('local-private')}
              type="radio"
              value="local-private"
            />
            <span className={styles.modeIcon}>
              <Icon icon={SquareLock02Icon} size={24} />
            </span>
            <span className={styles.modeBody}>
              <span className={styles.modeTitle}>
                Local Private <span className={styles.recommended}>Recommended</span>
              </span>
              <span className={styles.modeCopy}>
                Everything stays on this device. Import, generate, and study without an account.
              </span>
            </span>
          </label>

          <label
            className={
              mode === 'cloud-enhanced' ? `${styles.modeCard} ${styles.modeCardActive}` : styles.modeCard
            }
          >
            <input
              checked={mode === 'cloud-enhanced'}
              name="onboarding-mode"
              onChange={() => onChooseMode('cloud-enhanced')}
              type="radio"
              value="cloud-enhanced"
            />
            <span className={styles.modeIcon}>
              <Icon icon={CloudIcon} size={24} />
            </span>
            <span className={styles.modeBody}>
              <span className={styles.modeTitle}>
                Cloud Enhanced <span className={styles.comingSoon}>Coming soon</span>
              </span>
              <span className={styles.modeCopy}>
                A future connected path for stronger cards. Sign-in isn&apos;t available yet, so
                you&apos;ll still start locally.
              </span>
            </span>
          </label>
        </fieldset>
      </div>

      <div className={styles.signInRow}>
        <button className={styles.ghost} disabled title="Cloud sign-in ships after the hackathon" type="button">
          <Icon icon={CloudIcon} size={16} /> Sign in to cloud (coming soon)
        </button>
        <p className={styles.signInNote}>
          <Icon icon={FileUploadIcon} size={16} /> You can switch modes later from the dashboard.
        </p>
      </div>
    </section>
  )
}
