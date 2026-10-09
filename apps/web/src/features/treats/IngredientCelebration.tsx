import { useEffect, useId, useRef, type CSSProperties, type MouseEvent, type SyntheticEvent } from 'react'
import { ingredientById, TREAT_RECIPES } from './catalog'
import type { IngredientId } from './catalog'
import { IngredientIcon } from './TreatArt'
import styles from './IngredientCelebration.module.css'

const CONFETTI_COLORS = ['#E5A93C', '#8D6748', '#E9B58F', '#13703A', '#2346C8', '#BE2A1E', '#FFEF5A', '#F5EFEB']
const CONFETTI_COUNT = 44

/** Deterministic pseudo-random so the burst renders the same every time and render stays pure. */
const seeded = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, index) => {
  const angle = (index / CONFETTI_COUNT) * Math.PI * 2 + seeded(index) * 0.6
  const reach = 120 + seeded(index + 100) * 140
  return {
    style: {
      '--dx': `${Math.cos(angle) * reach}px`,
      '--dy': `${Math.sin(angle) * reach * 0.7 - 60}px`,
      '--fall': `${180 + seeded(index + 200) * 160}px`,
      '--spin': `${(seeded(index + 300) > 0.5 ? 1 : -1) * (360 + seeded(index + 400) * 540)}deg`,
      '--delay': `${seeded(index + 500) * 160}ms`,
      '--duration': `${1300 + seeded(index + 600) * 900}ms`,
      background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    } as CSSProperties,
    shape: index % 3 === 0 ? styles.round : index % 3 === 1 ? styles.strip : styles.square,
  }
})

interface IngredientCelebrationProps {
  /** The ingredient the repository stored for this answer; null keeps the pop-up closed. */
  ingredientId: IngredientId | null
  onClose: () => void
}

/**
 * Celebration pop-up for an ingredient found in Quiz. A native modal
 * <dialog> provides the focus trap and Esc; focus returns to whatever was
 * focused before it opened. "Keep going" takes focus so Enter dismisses it.
 * Confetti and the bounce stop under reduced motion.
 */
export function IngredientCelebration({ ingredientId, onClose }: IngredientCelebrationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<Element | null>(null)
  const titleId = useId()
  const isOpen = ingredientId !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus()
    }
  }, [isOpen])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onClose()
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) onClose()
  }

  const ingredient = ingredientId ? ingredientById[ingredientId] : undefined
  const recipes = ingredientId
    ? TREAT_RECIPES.filter((recipe) => recipe.ingredients.some((part) => part.id === ingredientId)).map((recipe) => recipe.name)
    : []

  return (
    <dialog aria-labelledby={titleId} className={styles.dialog} onCancel={handleCancel} onClick={handleBackdropClick} ref={dialogRef}>
      {ingredient ? (
        // Keyed by ingredient so each find replays the burst.
        <div className={styles.card} key={ingredient.id}>
          <div aria-hidden="true" className={styles.confetti}>
            {CONFETTI.map((piece, index) => <span className={`${styles.piece} ${piece.shape}`} key={index} style={piece.style} />)}
          </div>
          <div className={styles.art}>
            <span aria-hidden="true" className={styles.burst} />
            <span className={styles.icon}><IngredientIcon id={ingredient.id} loading="eager" size={160} /></span>
          </div>
          <p className={styles.eyebrow}>Ingredient found!</p>
          <h2 className={styles.title} id={titleId}>You found {ingredient.name}!</h2>
          <p className={styles.copy}>+1 {ingredient.name} is on your Treat Shelf.</p>
          {recipes.length > 0 ? <p className={styles.recipes}>Goes into {recipes.join(', ')}.</p> : null}
          <button autoFocus className={`primary-button ${styles.action}`} onClick={onClose} type="button">Keep going</button>
        </div>
      ) : null}
    </dialog>
  )
}
