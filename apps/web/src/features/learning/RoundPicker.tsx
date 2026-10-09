import { Link } from 'react-router'
import { ArrowLeft01Icon, ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import { pantryPath, practicePath, quizPath } from '../../app/navigation'
import type { PantrySummary } from '../pantries/repository'
import type { StudyMode } from '../../data/pantryRepository'
import { practiceRoundLength } from './practiceRound'
import styles from './LearningHub.module.css'

const COPY: Record<StudyMode, { label: string; lead: string; path: (pantryId: string) => string }> = {
  practice: {
    label: 'Practice',
    lead: 'Each round draws up to five of its cards in a new order.',
    path: practicePath,
  },
  quiz: {
    label: 'Quiz',
    lead: 'Each round draws up to five of its cards. Every correct answer finds an ingredient for Rokki’s Treat Shelf.',
    path: quizPath,
  },
}

/** Choose the pantry for a Practice or Quiz round. Pantries without cards link back to authoring. */
export function RoundPicker({ mode, pantries }: { mode: StudyMode; pantries: PantrySummary[] }) {
  const copy = COPY[mode]
  const headingId = `${mode}-picker-heading`

  return (
    <section className={styles.hub} aria-labelledby={headingId}>
      <Link className={styles.backLink} to="/learn"><Icon icon={ArrowLeft01Icon} size={16} />Learning Hub</Link>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{copy.label}</p>
        <h1 id={headingId}>Choose a pantry.</h1>
        <p className={styles.lead}>{copy.lead}</p>
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
                  <Link aria-label={`${copy.label} ${pantry.title}`} className="primary-button" to={copy.path(pantry.id)}>
                    {copy.label} <Icon icon={ArrowRight02Icon} />
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
