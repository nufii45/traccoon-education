import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight02Icon, CookieIcon, FileUploadIcon, Target02Icon } from '@hugeicons/core-free-icons'
import rokkiWelcome from '../../assets/rokki/rokki-welcome.webp'
import { QUIZ_PICKER_PATH, TREATS_PATH } from '../../app/navigation'
import { InteractiveRokki } from '../../components/InteractiveRokki'
import { Icon } from '../../components/Icon/Icon'
import { pantryRepository } from '../pantries/repository'
import type { PantrySummary, QuizSessionSummary, StudyAttempt } from '../pantries/repository'
import { TREAT_RECIPES, treatById } from '../treats/catalog'
import type { TreatId } from '../treats/catalog'
import { TreatIcon } from '../treats/TreatArt'
import type { TreatEconomy } from '../treats/engine'
import { summarizeRokkiProgress } from './progress'
import styles from './RokkiCorner.module.css'

interface CornerData {
  pantries: PantrySummary[]
  attempts: StudyAttempt[]
  quizzes: QuizSessionSummary[]
  economy: TreatEconomy
}

const INTRO_MESSAGES = [
  'Hey there! Ready to learn?',
  "I'm happy you're here!",
  'Every little step counts!',
] as const

export function RokkiCorner() {
  const [data, setData] = useState<CornerData>()
  const [error, setError] = useState<string>()
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let active = true
    setError(undefined)
    const load = async () => {
      const [pantries, quizzes, economy] = await Promise.all([
        pantryRepository.listPantries(),
        pantryRepository.listQuizSessionSummaries(),
        pantryRepository.loadTreatEconomy(),
      ])
      const attempts = (await Promise.all(pantries.map((pantry) => pantryRepository.listAttempts(pantry.id)))).flat()
      if (active) setData({ pantries, attempts, quizzes, economy })
    }
    void load().catch(() => {
      if (active) setError('Your local learning progress could not be opened. Try again to refresh Rokki’s Corner.')
    })
    return () => { active = false }
  }, [reloadCount])

  const progress = data
    ? summarizeRokkiProgress(data.pantries, data.attempts, data.quizzes, data.economy)
    : undefined
  const ownedTreats = data
    ? TREAT_RECIPES.filter((recipe) => (data.economy.treats[recipe.id] ?? 0) > 0).slice(0, 3)
    : []
  const messages = progress
    ? [progress.greeting, ...INTRO_MESSAGES]
    : INTRO_MESSAGES

  return (
    <section aria-labelledby="rokki-heading" className={styles.corner}>
      <header className={styles.hero}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Rokki’s Corner</p>
          <h1 id="rokki-heading">Say hello to <em>Rokki!</em></h1>
          <p className={styles.lead}>Your learning buddy is here to cheer you on, celebrate your progress, and help you find your next adventure.</p>
          <div className={styles.greeting} aria-live="polite">
            <span aria-hidden="true" className={styles.greetingMark}>✦</span>
            <span>{progress?.greeting ?? (error ? 'Your learning adventure starts here!' : 'Rokki is getting ready to say hello…')}</span>
          </div>
          <p className={styles.hint}>Tap Rokki, or press Enter while focused, to hear a little encouragement.</p>
        </div>
        <div className={styles.mascotStage}>
          <span aria-hidden="true" className={styles.stageRing} />
          <InteractiveRokki
            actionLabel="Talk to Rokki"
            className={styles.mascot}
            fallbackSrc={rokkiWelcome}
            imageAlt="Rokki, your learning companion"
            messages={messages}
            src="/assets/rokki/rokki-classic.svg"
            width={280}
          />
        </div>
      </header>

      {error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button className="secondary-button" onClick={() => setReloadCount((count) => count + 1)} type="button">Try again</button>
        </div>
      ) : null}

      <section aria-labelledby="journey-heading" className={styles.journey}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>Little steps add up</p>
            <h2 id="journey-heading">Your learning journey</h2>
          </div>
          <p>Saved on this device</p>
        </div>
        {progress ? (
          <div className={styles.stats}>
            <div><strong>{progress.cardCount}</strong><span>Study cards saved</span></div>
            <div><strong>{progress.cardsReviewed}</strong><span>Answers recorded</span></div>
            <div><strong>{progress.quizRounds}</strong><span>Quizzes finished</span></div>
            <div><strong>{progress.ingredients}</strong><span>Ingredients on hand</span></div>
          </div>
        ) : error ? (
          <p className={styles.empty}>Your progress is still on this device. Try opening it again.</p>
        ) : (
          <p className={styles.empty} role="status">Opening your local learning journey…</p>
        )}
        {progress && progress.pantryCount === 0 ? <p className={styles.empty}>Your learning adventure starts here!</p> : null}
      </section>

      <section aria-labelledby="next-heading" className={styles.next}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>Pick your next adventure</p>
            <h2 id="next-heading">What should we do today?</h2>
          </div>
        </div>
        <div className={styles.actions}>
          <Link className={styles.action} to="/pantries/import">
            <span className={styles.actionIcon}><Icon icon={FileUploadIcon} size={24} /></span>
            <strong>Make study cards</strong>
            <span>Turn your learning materials into quick review cards.</span>
            <span aria-hidden="true" className={styles.actionArrow}><Icon icon={ArrowRight02Icon} /></span>
          </Link>
          <Link className={styles.action} to={QUIZ_PICKER_PATH}>
            <span className={styles.actionIcon}><Icon icon={Target02Icon} size={24} /></span>
            <strong>Practice a quiz</strong>
            <span>Test what you know and keep improving.</span>
            <span aria-hidden="true" className={styles.actionArrow}><Icon icon={ArrowRight02Icon} /></span>
          </Link>
          <Link className={styles.action} to={TREATS_PATH}>
            <span className={styles.actionIcon}><Icon icon={CookieIcon} size={24} /></span>
            <strong>Explore treats</strong>
            <span>See what you’ve collected and create something fun.</span>
            <span aria-hidden="true" className={styles.actionArrow}><Icon icon={ArrowRight02Icon} /></span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="treats-heading" className={styles.shelf}>
        <div>
          <p className={styles.eyebrow}>A little something sweet</p>
          <h2 id="treats-heading">Rokki’s treat collection</h2>
          <p>{progress?.treats
            ? `${progress.treats} ${progress.treats === 1 ? 'treat is' : 'treats are'} waiting on your shelf.`
            : 'Answer Quiz questions to find ingredients, then make a treat for Rokki.'}</p>
          <Link className={styles.shelfLink} to={TREATS_PATH}>Open Treat Shelf <Icon icon={ArrowRight02Icon} size={20} /></Link>
        </div>
        {ownedTreats.length > 0 ? (
          <ul aria-label="Treats on your shelf" className={styles.treats}>
            {ownedTreats.map((recipe) => (
              <li key={recipe.id}>
                <TreatIcon id={recipe.id as TreatId} size={72} />
                <span>{treatById[recipe.id].name}</span>
                <strong>×{data?.economy.treats[recipe.id]}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div aria-hidden="true" className={styles.shelfEmpty}><Icon icon={CookieIcon} size={32} /></div>
        )}
      </section>
    </section>
  )
}
