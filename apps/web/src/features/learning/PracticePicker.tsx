import { Link } from 'react-router'
import { ArrowLeft01Icon, ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import { pantryPath, practicePath } from '../../app/navigation'
import type { PantrySummary } from '../pantries/repository'
import { practiceRoundLength } from './practiceRound'
import styles from './LearningHub.module.css'

/** Choose the pantry for a Practice round. Pantries without cards link back to authoring. */
export function PracticePicker({ pantries }: { pantries: PantrySummary[] }) {
  return (
    <section className={styles.hub} aria-labelledby="practice-picker-heading">
      <Link className={styles.backLink} to="/learn"><Icon icon={ArrowLeft01Icon} size={16} />Learning Hub</Link>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Practice</p>
        <h1 id="practice-picker-heading">Choose a pantry.</h1>
        <p className={styles.lead}>Each round draws up to five of its cards in a new order.</p>
      </header>

      {pantries.length === 0 ? (
        <p className={styles.note}>You have no pantries yet. <Link to="/pantries">Go to My Pantries</Link></p>
      ) : (
        <ul className={styles.pantryList}>
          {pantries.map((pantry) => {
            const roundLength = practiceRoundLength(pantry.cardCount)
            return (
              <li className={styles.pantryRow} key={pantry.id}>
                <span className={styles.modeBody}>
                  <span className={styles.modeTitle}>{pantry.title}</span>
                  <span className={styles.modeMeta}>
                    {pantry.cardCount} {pantry.cardCount === 1 ? 'card' : 'cards'}
                    {roundLength > 0 ? ` · round of ${roundLength}` : ''}
                  </span>
                </span>
                {roundLength > 0 ? (
                  <Link aria-label={`Practice ${pantry.title}`} className="primary-button" to={practicePath(pantry.id)}>
                    Practice <Icon icon={ArrowRight02Icon} />
                  </Link>
                ) : (
                  <Link className="secondary-button" to={pantryPath(pantry.id)}>Add cards</Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
