import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { QUIZ_PICKER_PATH } from '../../app/navigation'
import { RokkiLoader } from '../../components/RokkiLoader/RokkiLoader'
import { pantryRepository } from '../pantries/repository'
import { INGREDIENTS, TREAT_RECIPES, ingredientById, treatById } from './catalog'
import type { TreatId } from './catalog'
import { canCraft, missingIngredients, totalIngredients, totalOwnedTreats, type TreatEconomy } from './engine'
import { IngredientIcon, TreatIcon } from './TreatArt'
import styles from './TreatKitchen.module.css'

type RecipeFilter = 'all' | 'ready' | 'owned'

const FILTER_LABELS: Record<RecipeFilter, string> = {
  all: `All ${TREAT_RECIPES.length} recipes`,
  ready: 'Ready to make',
  owned: 'On my shelf',
}

const createActionId = () => globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`

const errorMessage = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback)

interface RecipeCardProps {
  treatId: TreatId
  economy: TreatEconomy
  isBusy: boolean
  onMake: (treatId: TreatId) => void
  onFeed: (treatId: TreatId) => void
}

function RecipeCard({ treatId, economy, isBusy, onMake, onFeed }: RecipeCardProps) {
  const recipe = treatById[treatId]
  const parts = missingIngredients(economy, treatId)
  const collected = parts.filter((part) => part.missing === 0).length
  const isReady = canCraft(economy, treatId)
  const owned = economy.treats[treatId] ?? 0
  const stillNeeded = parts.filter((part) => part.missing > 0).map((part) => ingredientById[part.id].name)

  return (
    <article aria-label={`${recipe.name} recipe`} className={styles.recipe}>
      <div className={styles.recipeArt}>
        <TreatIcon id={treatId} size={144} />
        {owned > 0 ? <span className={styles.owned}>On shelf ×{owned}</span> : null}
      </div>
      <div className={styles.recipeBody}>
        <h2 className={styles.recipeName}>{recipe.name}</h2>
        <div className={styles.progressLabel}>
          <span>{collected}/{parts.length} ingredients</span>
          <span>{isReady ? 'Ready to make' : 'Collecting'}</span>
        </div>
        <div
          aria-label={`${recipe.name} ingredients collected`}
          aria-valuemax={parts.length}
          aria-valuemin={0}
          aria-valuenow={collected}
          className={styles.progress}
          role="progressbar"
        >
          <div style={{ width: `${(collected / parts.length) * 100}%` }} />
        </div>
        <ul aria-label={`${recipe.name} ingredients`} className={styles.parts}>
          {parts.map((part) => (
            <li className={part.missing === 0 ? `${styles.part} ${styles.collected}` : styles.part} key={part.id} title={ingredientById[part.id].name}>
              <IngredientIcon id={part.id} recipeImage={part.recipeImage} size={44} />
              <small aria-label={`${Math.min(part.owned, part.required)} of ${part.required}`}>{Math.min(part.owned, part.required)}/{part.required}</small>
            </li>
          ))}
        </ul>
        <p className={styles.needed}>
          {stillNeeded.length === 0 ? 'Every ingredient collected.' : `Still needed: ${stillNeeded.join(', ')}`}
        </p>
        <div className={styles.actions}>
          <button className="primary-button" disabled={!isReady || isBusy} onClick={() => onMake(treatId)} type="button">
            {isReady ? 'Make treat' : 'Collect ingredients'}
          </button>
          {owned > 0 ? (
            <button className="secondary-button" disabled={isBusy} onClick={() => onFeed(treatId)} type="button">Feed Rokki</button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/**
 * Treat Shelf: ingredients found in Quiz, the ten recipes, crafted treats,
 * and manual feeding. Everything is stored on this device. Nothing here
 * gates studying.
 */
export function TreatKitchen() {
  const [economy, setEconomy] = useState<TreatEconomy>()
  const [loadError, setLoadError] = useState<string>()
  const [filter, setFilter] = useState<RecipeFilter>('all')
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean }>()

  const load = useCallback(() => {
    setLoadError(undefined)
    pantryRepository
      .loadTreatEconomy()
      .then(setEconomy)
      .catch((reason: unknown) => setLoadError(errorMessage(reason, 'Your Treat Shelf could not be opened on this device.')))
  }, [])

  useEffect(load, [load])

  const run = async (action: () => Promise<{ state: TreatEconomy }>, success: string, failure: string) => {
    setIsBusy(true)
    setMessage(undefined)
    try {
      setEconomy((await action()).state)
      setMessage({ text: success, isError: false })
    } catch (reason) {
      setMessage({ text: errorMessage(reason, failure), isError: true })
    } finally {
      setIsBusy(false)
    }
  }

  const make = (treatId: TreatId) =>
    void run(() => pantryRepository.craftTreat(createActionId(), treatId), `Made a ${treatById[treatId].name}. It is on your shelf.`, 'This treat could not be made.')

  const feed = (treatId: TreatId) =>
    void run(() => pantryRepository.feedTreat(createActionId(), treatId), `Rokki enjoyed the ${treatById[treatId].name}.`, 'Rokki could not be fed this treat.')

  const recipes = economy
    ? TREAT_RECIPES.filter((recipe) => {
      if (filter === 'ready') return canCraft(economy, recipe.id)
      if (filter === 'owned') return (economy.treats[recipe.id] ?? 0) > 0
      return true
    })
    : []
  const ownedIngredients = economy ? INGREDIENTS.filter((item) => (economy.ingredients[item.id] ?? 0) > 0) : []

  return (
    <section aria-labelledby="treats-heading" className={styles.kitchen}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Treat Shelf</p>
        <h1 id="treats-heading">Make something sweet for Rokki.</h1>
        <p className={styles.lead}>
          Correct Quiz answers find random ingredients. Collect all five for a recipe to make that treat.
        </p>
      </header>

      {loadError ? (
        <div className="global-error" role="alert">
          <span>{loadError}</span>
          <button className="secondary-button" onClick={load} type="button">Try again</button>
        </div>
      ) : null}

      {!economy && !loadError ? <RokkiLoader mode="preparing" size="sm" title="Opening your Treat Shelf." description="Reading your ingredients from this device." /> : null}

      {economy ? (
        <>
          <dl className={styles.stats}>
            <div><dt>Treats on shelf</dt><dd>{totalOwnedTreats(economy)}</dd></div>
            <div><dt>Ingredients</dt><dd>{totalIngredients(economy)}</dd></div>
            <div><dt>Recipes ready</dt><dd>{TREAT_RECIPES.filter((recipe) => canCraft(economy, recipe.id)).length}</dd></div>
          </dl>

          <section aria-labelledby="ingredients-heading" className={styles.pantry}>
            <h2 id="ingredients-heading">Your ingredients</h2>
            {ownedIngredients.length === 0 ? (
              <p className={styles.note}>
                No ingredients yet. <Link to={QUIZ_PICKER_PATH}>Take a Quiz</Link> to find some.
              </p>
            ) : (
              <ul className={styles.ingredientList}>
                {ownedIngredients.map((item) => (
                  <li key={item.id}>
                    <IngredientIcon id={item.id} size={48} />
                    <span>{item.name}</span>
                    <strong aria-label={`${economy.ingredients[item.id]} owned`}>×{economy.ingredients[item.id]}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div aria-label="Filter recipes" className={styles.filters} role="group">
            {(Object.keys(FILTER_LABELS) as RecipeFilter[]).map((name) => (
              <button aria-pressed={filter === name} className={filter === name ? `${styles.filter} ${styles.filterOn}` : styles.filter} key={name} onClick={() => setFilter(name)} type="button">
                {FILTER_LABELS[name]}
              </button>
            ))}
          </div>

          {message ? <p className={message.isError ? 'form-error' : styles.message} role={message.isError ? 'alert' : 'status'}>{message.text}</p> : null}

          {recipes.length === 0 ? (
            <p className={styles.empty}>Nothing here yet. Quiz answers keep finding ingredients.</p>
          ) : (
            <div className={styles.grid}>
              {recipes.map((recipe) => (
                <RecipeCard economy={economy} isBusy={isBusy} key={recipe.id} onFeed={feed} onMake={make} treatId={recipe.id} />
              ))}
            </div>
          )}
        </>
      ) : null}

      <p className={styles.footnote}>Feeding is always your choice. Studying is never locked by ingredients or treats.</p>
    </section>
  )
}
