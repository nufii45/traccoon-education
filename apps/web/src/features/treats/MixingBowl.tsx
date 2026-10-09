import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react'
import { ingredientById, treatById, TREAT_RECIPES } from './catalog'
import type { IngredientId, TreatId } from './catalog'
import type { TreatEconomy } from './engine'
import {
  createMixingState,
  isMixed,
  isReady,
  mixingReducer,
  stirAmountFromDistance,
  MIX_HOLD_STEP,
  type MixPhase,
} from './mixingState'
import { IngredientIcon, TreatIcon } from './TreatArt'
import styles from './MixingBowl.module.css'

const CONFETTI_COLORS = ['#E5A93C', '#8D6748', '#E9B58F', '#13703A', '#2346C8', '#BE2A1E', '#FFEF5A', '#F5EFEB']
const CONFETTI_COUNT = 40

/** Deterministic pseudo-random so the reveal burst renders the same every time and render stays pure. */
const seeded = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, index) => {
  const angle = (index / CONFETTI_COUNT) * Math.PI * 2 + seeded(index) * 0.6
  const reach = 110 + seeded(index + 100) * 150
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

/** Fixed orbit positions so placed ingredients swirl around the bowl without layout thrash. */
const slotStyle = (index: number, total: number): CSSProperties => {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2
  return {
    '--angle': `${angle}rad`,
    '--orbit-delay': `${index * 90}ms`,
  } as CSSProperties
}

const PHASE_PROMPT: Record<MixPhase, string> = {
  idle: 'Add the ingredients to the bowl.',
  selecting: 'Add the rest of the ingredients.',
  ready: "Everything's in. Let's mix!",
  mixing: 'Stir around the bowl to mix!',
  crafting: 'Making your treat…',
  revealing: 'Ta-da!',
  completed: 'Ta-da!',
  failed: 'That treat could not be made.',
}

interface MixingBowlProps {
  /** Open the bowl for this treat; null keeps it closed. */
  treatId: TreatId | null
  economy: TreatEconomy
  /**
   * Commit the real craft through the existing idempotent repository. Called
   * exactly once, only after interactive mixing completes. Resolves with the
   * next economy; rejects to drive the failed state (no ingredients spent).
   */
  onCommitCraft: (treatId: TreatId) => Promise<TreatEconomy>
  /** The learner chose to view the finished treat on the shelf. */
  onViewShelf: (next: TreatEconomy) => void
  /** Closed without finishing (Esc, backdrop, or Cancel) — nothing is crafted. */
  onClose: () => void
}

/**
 * Interactive mixing experience. A native modal <dialog> (same focus trap and
 * Esc handling as IngredientCelebration) walks the learner through placing
 * ingredients, stirring by pointer / hold / keyboard, and a confetti reveal
 * of the exact treat the recipe produces. The underlying inventory change is
 * committed through the existing craft rules via onCommitCraft; this file is
 * presentation only and never spends ingredients itself.
 */
export function MixingBowl({ treatId, economy, onCommitCraft, onViewShelf, onClose }: MixingBowlProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<Element | null>(null)
  const titleId = useId()
  const promptId = useId()
  const isOpen = treatId !== null

  // The machine is re-seeded whenever a new treat opens the bowl.
  const [state, dispatch] = useReducer(mixingReducer, treatId, (id) => createMixingState(id ?? firstTreatId()))
  const [craftedEconomy, setCraftedEconomy] = useState<TreatEconomy>()

  // Pointer stir bookkeeping (refs so moves do not re-render per frame).
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const holdTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const treat = treatId ? treatById[treatId] : undefined

  // Reset the machine each time the bowl opens for a treat.
  useEffect(() => {
    if (treatId) {
      dispatch({ type: 'reset', treatId })
      setCraftedEconomy(undefined)
    }
  }, [treatId])

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

  // Clear any running hold interval on unmount or close.
  useEffect(() => () => clearInterval(holdTimer.current), [])

  // Once fully mixed, move into crafting exactly once (idempotent in the reducer).
  const mixed = isMixed(state)
  useEffect(() => {
    if (state.phase === 'mixing' && mixed) dispatch({ type: 'beginCrafting' })
  }, [state.phase, mixed])

  // Commit the real craft when crafting begins. Guarded so it runs once per
  // crafting entry; a cancelled run (unmount/close) never reveals or fails.
  useEffect(() => {
    if (state.phase !== 'crafting' || !treatId) return
    let cancelled = false
    onCommitCraft(treatId)
      .then((next) => {
        if (cancelled) return
        setCraftedEconomy(next)
        dispatch({ type: 'craftSucceeded' })
        dispatch({ type: 'reveal' })
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        dispatch({ type: 'craftFailed', error: reason instanceof Error ? reason.message : 'This treat could not be made.' })
      })
    return () => {
      cancelled = true
    }
  }, [state.phase, treatId, onCommitCraft])

  const stopHold = useCallback(() => {
    clearInterval(holdTimer.current)
    holdTimer.current = undefined
  }, [])

  const close = useCallback(() => {
    stopHold()
    onClose()
  }, [onClose, stopHold])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    close()
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) close()
  }

  // Pointer stir: accumulate travelled distance into mix progress.
  const handleBowlPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (state.phase !== 'mixing') return
    const previous = lastPoint.current
    const point = { x: event.clientX, y: event.clientY }
    lastPoint.current = point
    if (!previous) return
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
    const amount = stirAmountFromDistance(distance)
    if (amount > 0) dispatch({ type: 'stir', amount })
  }

  const handleBowlPointerLeave = () => {
    lastPoint.current = null
  }

  // Accessible press-and-hold alternative to pointer stirring.
  const startHold = () => {
    if (state.phase !== 'mixing') return
    stopHold()
    dispatch({ type: 'stir', amount: MIX_HOLD_STEP })
    holdTimer.current = setInterval(() => dispatch({ type: 'stir', amount: MIX_HOLD_STEP }), 90)
  }

  // Keyboard alternative: each activation nudges the mix forward.
  const handleMixKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      if (state.phase === 'mixing') dispatch({ type: 'stir', amount: MIX_HOLD_STEP })
    }
  }

  if (!treat || !treatId) {
    return <dialog aria-labelledby={titleId} className={styles.dialog} onCancel={handleCancel} onClick={handleBackdropClick} ref={dialogRef} />
  }

  const owned = (id: IngredientId) => economy.ingredients[id] ?? 0
  const progressPct = Math.round(state.progress * 100)
  const showReveal = state.phase === 'revealing' || state.phase === 'completed'

  return (
    <dialog
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      ref={dialogRef}
    >
      <div className={styles.card} key={treatId}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>Treat kitchen</p>
          <h2 className={styles.title} id={titleId}>{treat.name}</h2>
          <p className={styles.prompt} id={promptId} role="status">{PHASE_PROMPT[state.phase]}</p>
        </header>

        {showReveal ? (
          <div className={styles.reveal}>
            <div aria-hidden="true" className={styles.confetti}>
              {CONFETTI.map((piece, index) => <span className={`${styles.piece} ${piece.shape}`} key={index} style={piece.style} />)}
            </div>
            <div className={styles.revealArt}>
              <span aria-hidden="true" className={styles.burst} />
              <span className={styles.revealIcon}><TreatIcon id={treatId} size={180} /></span>
            </div>
            <p className={styles.revealCopy}>Yay! You made a {treat.name}!</p>
            <button
              autoFocus
              className={`primary-button ${styles.action}`}
              onClick={() => onViewShelf(craftedEconomy ?? economy)}
              type="button"
            >
              View in Treat Shelf
            </button>
          </div>
        ) : (
          <>
            <div
              aria-label={`Mixing bowl for ${treat.name}`}
              className={`${styles.bowl} ${state.phase === 'mixing' ? styles.bowlMixing : ''}`.trim()}
              onPointerLeave={handleBowlPointerLeave}
              onPointerMove={handleBowlPointerMove}
            >
              <div className={styles.bowlInner} style={{ '--mix': String(state.progress) } as CSSProperties}>
                {state.placed.length === 0 ? (
                  <span className={styles.bowlHint}>Empty bowl</span>
                ) : (
                  state.placed.map((id, index) => (
                    <button
                      aria-label={state.phase === 'mixing' || state.phase === 'crafting'
                        ? ingredientById[id].name
                        : `Remove ${ingredientById[id].name}`}
                      className={styles.orbit}
                      disabled={state.phase === 'mixing' || state.phase === 'crafting'}
                      key={id}
                      onClick={() => dispatch({ type: 'remove', ingredientId: id })}
                      style={slotStyle(index, state.placed.length)}
                      type="button"
                    >
                      <IngredientIcon id={id} size={48} />
                    </button>
                  ))
                )}
              </div>
              {state.phase === 'crafting' ? <span className={styles.spinner} aria-hidden="true" /> : null}
            </div>

            {state.phase === 'mixing' ? (
              <div className={styles.mixControls}>
                <div
                  aria-label="Mixing progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={progressPct}
                  className={styles.progress}
                  role="progressbar"
                >
                  <div style={{ width: `${progressPct}%` }} />
                </div>
                <button
                  className={`secondary-button ${styles.holdButton}`}
                  onKeyDown={handleMixKeyDown}
                  onPointerCancel={stopHold}
                  onPointerDown={startHold}
                  onPointerLeave={stopHold}
                  onPointerUp={stopHold}
                  type="button"
                >
                  Hold to mix
                </button>
              </div>
            ) : (
              <div className={styles.tray} role="group" aria-label="Your ingredients">
                {state.required.map((id) => {
                  const placed = state.placed.includes(id)
                  const have = owned(id)
                  const canPlace = !placed && have > 0
                  return (
                    <button
                      aria-label={placed
                        ? `${ingredientById[id].name} added`
                        : have > 0
                          ? `Add ${ingredientById[id].name}`
                          : `${ingredientById[id].name} not collected yet`}
                      aria-pressed={placed}
                      className={`${styles.trayItem} ${placed ? styles.trayPlaced : ''}`.trim()}
                      disabled={!canPlace}
                      key={id}
                      onClick={() => dispatch({ type: 'place', ingredientId: id })}
                      type="button"
                    >
                      <IngredientIcon id={id} size={40} />
                      <small>{ingredientById[id].name}</small>
                      {placed ? <span aria-hidden="true" className={styles.check}>✓</span> : null}
                    </button>
                  )
                })}
              </div>
            )}

            {state.phase === 'failed' ? <p className="form-error" role="alert">{state.error}</p> : null}

            <div className={styles.actions}>
              {isReady(state) && state.phase === 'ready' ? (
                <button className={`primary-button ${styles.action}`} onClick={() => dispatch({ type: 'startMixing' })} type="button">
                  Let's mix!
                </button>
              ) : null}
              {state.phase !== 'mixing' && state.phase !== 'crafting' ? (
                <button className={`secondary-button ${styles.action}`} onClick={close} type="button">
                  {state.phase === 'failed' ? 'Close' : 'Cancel'}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}

/** Any valid treat id to seed the lazy reducer initializer before the first open. */
function firstTreatId(): TreatId {
  return TREAT_RECIPES[0].id
}
