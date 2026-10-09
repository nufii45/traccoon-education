import { Link } from 'react-router'
import { ArrowRight02Icon, CookieIcon, Target02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import { PRACTICE_PICKER_PATH, QUIZ_PICKER_PATH } from '../../app/navigation'
import type { PantrySummary } from '../pantries/repository'
import { PRACTICE_ROUND_SIZE } from './practiceRound'
import styles from './LearningHub.module.css'

/**
 * Entry point for studying. Practice and Quiz draw on the same pantry cards;
 * only Quiz answers find ingredients for the Treat Shelf.
 */
export function LearningHub({ pantries }: { pantries: PantrySummary[] }) {
  const readyPantries = pantries.filter((pantry) => pantry.cardCount > 0).length
  const readyMeta = readyPantries === 0 ? 'No pantry has cards yet' : `${readyPantries} ${readyPantries === 1 ? 'pantry' : 'pantries'} ready`

  return (
    <section className={styles.hub} aria-labelledby="learning-hub-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Learning Hub</p>
        <h1 id="learning-hub-heading">Pick how you want to study.</h1>
        <p className={styles.lead}>Both modes use the cards in your pantries. Your answers stay on this device.</p>
      </header>

      <div className={styles.modes}>
        <Link className={styles.modeCard} to={PRACTICE_PICKER_PATH}>
          <span className={styles.modeIcon}><Icon icon={Target02Icon} size={24} /></span>
          <span className={styles.modeBody}>
            <span className={styles.modeTitle}>Practice</span>
            <span className={styles.modeCopy}>
              Up to {PRACTICE_ROUND_SIZE} cards a round. After each answer, open the page the card came from.
            </span>
            <span className={styles.modeMeta}>{readyMeta}</span>
          </span>
          <Icon icon={ArrowRight02Icon} />
        </Link>

        <Link className={styles.modeCard} to={QUIZ_PICKER_PATH}>
          <span className={styles.modeIcon}><Icon icon={CookieIcon} size={24} /></span>
          <span className={styles.modeBody}>
            <span className={styles.modeTitle}>Quiz</span>
            <span className={styles.modeCopy}>
              Up to {PRACTICE_ROUND_SIZE} cards a round. Every correct answer finds an ingredient for Rokki’s Treat Shelf.
            </span>
            <span className={styles.modeMeta}>{readyMeta}</span>
          </span>
          <Icon icon={ArrowRight02Icon} />
        </Link>
      </div>

      {readyPantries === 0 ? (
        <p className={styles.note}>
          Add cards to a pantry first. <Link to="/pantries">Go to My Pantries</Link>
        </p>
      ) : null}
    </section>
  )
}
