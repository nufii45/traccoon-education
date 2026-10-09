import type { CSSProperties } from 'react'
import { loadingMessages, type RokkiLoadingMode } from './loadingMessages'
import styles from './RokkiLoader.module.css'

export type { RokkiLoadingMode } from './loadingMessages'
export type RokkiLoaderSize = 'sm' | 'md' | 'lg' | number

export interface RokkiLoaderProps {
  /** Show contextual copy by default; false makes this a compact, icon-only loader. */
  showLabel?: boolean
  /** Use the application stage appropriate to the current async operation. */
  mode?: RokkiLoadingMode
  /** Override the supplied message with an action-specific, truthful description. */
  title?: string
  description?: string
  /** Three consistent presets or exact diameter in CSS pixels. */
  size?: RokkiLoaderSize
  /** Provide ONLY when your actual async operation reports meaningful progress (0–100). */
  progress?: number
  /** Base path for the bundled /assets/rokki directory, e.g. '/traccoon/'. */
  assetBasePath?: string
  /** False when a nearby live region already announces this operation, so it is not read twice. */
  announce?: boolean
  className?: string
  style?: CSSProperties
}

const DIAMETERS = { sm: 84, md: 172, lg: 244 } as const
const CIRCUMFERENCE = 2 * Math.PI * 94

/**
 * Animated Rokki loading indicator. Uses the original Traccoon head SVG; the
 * ring and bob are CSS-only and stop under reduced motion. Never simulates
 * progress: only pass `progress` if the operation supplies it.
 */
export function RokkiLoader({
  mode = 'preparing',
  title,
  description,
  showLabel = true,
  size = 'md',
  progress,
  assetBasePath = import.meta.env.BASE_URL,
  announce = true,
  className = '',
  style,
}: RokkiLoaderProps) {
  const copy = loadingMessages[mode]
  const heading = title ?? copy.title
  const details = description ?? copy.description
  const diameter = typeof size === 'number' ? Math.max(size, 32) : DIAMETERS[size]
  const hasProgress = typeof progress === 'number' && Number.isFinite(progress)
  const value = hasProgress ? Math.max(0, Math.min(100, progress)) : 0
  const imageSrc = `${assetBasePath.replace(/\/?$/, '/')}assets/rokki/rokki-classic.svg`
  const customStyle = { '--rk-diameter': `${diameter}px`, ...style } as CSSProperties

  return (
    <div
      aria-atomic={announce ? true : undefined}
      aria-live={announce ? 'polite' : undefined}
      className={`${styles.loader} ${className}`.trim()}
      data-progress={hasProgress ? 'determinate' : 'indeterminate'}
      role={announce ? 'status' : undefined}
      style={customStyle}
    >
      <div className={styles.scene}>
        <svg aria-hidden="true" className={styles.ring} fill="none" viewBox="0 0 220 220">
          <circle className={styles.track} cx="110" cy="110" r="94" />
          {hasProgress ? (
            <circle
              className={styles.progress}
              cx="110"
              cy="110"
              r="94"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
            />
          ) : (
            <circle className={styles.sweep} cx="110" cy="110" r="94" />
          )}
        </svg>
        <span aria-hidden="true" className={`${styles.spark} ${styles.sparkA}`} />
        <span aria-hidden="true" className={`${styles.spark} ${styles.sparkB}`} />
        <img alt="" aria-hidden="true" className={styles.mascot} draggable={false} src={imageSrc} />
      </div>
      {showLabel ? (
        <div className={styles.copy}>
          <div className={styles.eyebrow}>TRACCOON EDUCATION</div>
          <div className={styles.title}>{heading}</div>
          {details ? <p className={styles.description}>{details}</p> : null}
          {hasProgress ? <div className={styles.percentage}>{Math.round(value)}% complete</div> : null}
        </div>
      ) : (
        <span className={styles.srOnly}>{heading}{hasProgress ? ` ${Math.round(value)}% complete` : ''}</span>
      )}
      {hasProgress ? (
        <span
          aria-label={heading}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={value}
          className={styles.srOnly}
          role="progressbar"
        />
      ) : null}
    </div>
  )
}

export interface RokkiLoadingScreenProps extends RokkiLoaderProps {
  /** Accessible name for the full-route loading region. */
  label?: string
}

/**
 * Full-route wait. Not a modal: use it only when replacing the route content
 * is appropriate; prefer {@link RokkiLoader} near the area that is busy.
 */
export function RokkiLoadingScreen({ label, className, ...props }: RokkiLoadingScreenProps) {
  return (
    <section aria-label={label ?? 'Loading your study space'} className={`${styles.screen} ${className ?? ''}`.trim()}>
      <RokkiLoader {...props} size={props.size ?? 'lg'} />
    </section>
  )
}
