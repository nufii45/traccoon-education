import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { pickMessage } from './messages'
import { useInView } from './useInView'
import { useReducedMotion } from './useReducedMotion'
import styles from './InteractiveRokki.module.css'

/**
 * Learning-driven states. Hover and click are handled internally; these are
 * the states the host application sets to reflect real system activity.
 * - `idle`: gentle breathing/float while visible.
 * - `greeting`: a brief welcoming motion when the section first appears.
 * - `thinking`: subtle motion while an async operation is genuinely running.
 * - `celebrating`: a short happy bounce after an operation truly succeeds.
 */
export type RokkiState = 'idle' | 'greeting' | 'thinking' | 'celebrating'

export interface InteractiveRokkiProps {
  /** The Rokki illustration to show (an imported image URL). */
  src: string
  /** Existing static artwork shown if the primary image cannot load. */
  fallbackSrc?: string
  /** Accessible description of the illustration itself. */
  imageAlt: string
  /**
   * Current mascot state reflecting real application activity. The mascot
   * reflects state; it never controls gameplay logic.
   */
  state?: RokkiState
  /**
   * When true (default), the mascot is an interactive button that tilts on
   * hover and gives a playful response on click/tap. When false it is a
   * decorative, non-interactive image.
   */
  interactive?: boolean
  /** Accessible label for the interactive button (what activating it does). */
  actionLabel?: string
  /** Optional click/tap handler, in addition to the built-in playful reaction. */
  onActivate?: () => void
  /** Optional page-specific greetings; defaults to Rokki's general messages. */
  messages?: readonly string[]
  /** Pixel width of the mascot; height scales automatically. Default 200. */
  width?: number
  className?: string
  style?: CSSProperties
}

const MAX_TILT_DEGREES = 6
const REACTION_MS = 4000
const REACTION_MOTION_MS = 900
const GREETING_MS = 1200

/**
 * A lightweight, reusable interactive Rokki mascot built around the existing
 * single-image artwork using whole-character CSS transforms only. It supports
 * a subtle idle float, a hover tilt toward the pointer, a playful click/tap
 * reaction with a short speech bubble, and learning-event states (greeting,
 * thinking, celebrating). All motion respects `prefers-reduced-motion` and
 * pauses when the mascot is scrolled out of view.
 */
export function InteractiveRokki({
  src,
  fallbackSrc,
  imageAlt,
  state = 'idle',
  interactive = true,
  actionLabel,
  onActivate,
  messages,
  width = 200,
  className,
  style,
}: InteractiveRokkiProps) {
  const reducedMotion = useReducedMotion()
  const { ref, inView, hasEntered } = useInView<HTMLDivElement>({ threshold: 0.25, once: false })

  const [tilt, setTilt] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [reaction, setReaction] = useState<string | null>(null)
  const [isReacting, setIsReacting] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactionMotionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const greetingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMessage = useRef<string | undefined>(undefined)
  const hasGreeted = useRef(false)

  // A brief welcoming motion the first time the mascot scrolls into view,
  // unless the host already drives a non-idle state or motion is reduced.
  useEffect(() => {
    if (!hasEntered || hasGreeted.current || reducedMotion || state !== 'idle') {
      return
    }
    hasGreeted.current = true
    setShowGreeting(true)
    greetingTimer.current = setTimeout(() => setShowGreeting(false), GREETING_MS)
  }, [hasEntered, reducedMotion, state])

  useEffect(() => {
    return () => {
      if (reactionTimer.current) clearTimeout(reactionTimer.current)
      if (reactionMotionTimer.current) clearTimeout(reactionMotionTimer.current)
      if (greetingTimer.current) clearTimeout(greetingTimer.current)
    }
  }, [])

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (reducedMotion || event.pointerType === 'touch') return
      const rect = event.currentTarget.getBoundingClientRect()
      if (rect.width === 0) return
      const offset = (event.clientX - rect.left) / rect.width - 0.5
      setTilt(Math.max(-MAX_TILT_DEGREES, Math.min(MAX_TILT_DEGREES, offset * 2 * MAX_TILT_DEGREES)))
    },
    [reducedMotion],
  )

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'touch') return
      setIsHovering(true)
    },
    [],
  )

  const handlePointerLeave = useCallback(() => {
    setIsHovering(false)
    setTilt(0)
  }, [])

  // Trigger a brief playful reaction. A lock prevents rapid clicks from
  // stacking overlapping animations: a new click is ignored until the current
  // reaction clears.
  const react = useCallback(() => {
    onActivate?.()
    if (reaction !== null) return
    const message = pickMessage(lastMessage.current, Math.random, messages)
    lastMessage.current = message
    setReaction(message)
    setIsReacting(true)
    reactionMotionTimer.current = setTimeout(() => setIsReacting(false), REACTION_MOTION_MS)
    reactionTimer.current = setTimeout(() => setReaction(null), REACTION_MS)
  }, [onActivate, reaction, messages])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      // Buttons activate on Enter/Space via click, but Space scrolls by
      // default; prevent that so activation stays predictable.
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()
      }
    },
    [],
  )

  // Idle/float runs only when visible, interactive-or-not, and motion allowed.
  const animateIdle = inView && !reducedMotion
  const resolvedState: RokkiState | 'hover' = showGreeting
    ? 'greeting'
    : isHovering && state === 'idle'
      ? 'hover'
      : state

  const figureStyle = {
    '--rk-width': `${width}px`,
    '--rk-tilt': `${tilt}deg`,
    ...style,
  } as CSSProperties

  const image = (
    <img
      alt={imageAlt}
      className={styles.image}
      draggable={false}
      onError={() => { if (fallbackSrc && !imageFailed) setImageFailed(true) }}
      src={imageFailed && fallbackSrc ? fallbackSrc : src}
      // Reserve space so entrance/scale never shifts surrounding layout.
      style={{ width: '100%', height: 'auto' }}
    />
  )

  return (
    <div
      className={`${styles.root} ${className ?? ''}`.trim()}
      data-animate={animateIdle ? 'true' : 'false'}
      data-entered={hasEntered ? 'true' : 'false'}
      data-reduced={reducedMotion ? 'true' : 'false'}
      data-reacting={isReacting ? 'true' : 'false'}
      data-state={resolvedState}
      ref={ref}
      style={figureStyle}
    >
      <div aria-hidden={reaction === null} className={styles.bubbleSlot}>
        {reaction !== null ? (
          <span className={styles.bubble} role="status">
            {reaction}
          </span>
        ) : null}
      </div>

      {interactive ? (
        <button
          aria-label={actionLabel ?? 'Say hello to Rokki'}
          className={styles.trigger}
          onClick={react}
          onKeyDown={handleKeyDown}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          type="button"
        >
          <span className={styles.figure}>{image}</span>
        </button>
      ) : (
        <span className={styles.figure}>{image}</span>
      )}
    </div>
  )
}
