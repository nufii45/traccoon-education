import { useState } from 'react'
import { ingredientById, treatById } from './catalog'
import type { IngredientId, TreatId } from './catalog'
import { treatAssetUrl } from './assets'
import type { EconomyEvent } from './engine'
import styles from './TreatArt.module.css'

interface ArtImageProps {
  name: string
  src: string
  size: number
  className?: string
  /** Lazy by default for gallery grids; use eager for art the learner is looking at now. */
  loading?: 'lazy' | 'eager'
}

/** A treat WebP; if it fails to load, its name stays visible in the same box instead of a broken image. */
function ArtImage({ name, src, size, className = '', loading = 'lazy' }: ArtImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>()
  const box = { width: size, height: size }

  if (failedSrc === src) {
    return <span aria-label={name} className={`${styles.missing} ${className}`.trim()} role="img" style={box}>{name}</span>
  }
  return (
    <img
      alt={name}
      className={`${styles.image} ${className}`.trim()}
      decoding="async"
      draggable={false}
      height={size}
      loading={loading}
      onError={() => setFailedSrc(src)}
      src={src}
      width={size}
    />
  )
}

export function IngredientIcon({
  id,
  size = 56,
  recipeImage,
  loading,
}: {
  id: IngredientId
  size?: number
  recipeImage?: string
  loading?: 'lazy' | 'eager'
}) {
  const ingredient = ingredientById[id]
  return <ArtImage loading={loading} name={ingredient.name} size={size} src={treatAssetUrl(recipeImage ?? ingredient.image)} />
}

export function TreatIcon({ id, size = 140 }: { id: TreatId; size?: number }) {
  const treat = treatById[id]
  return <ArtImage className={styles.treat} name={treat.name} size={size} src={treatAssetUrl(treat.image)} />
}

/** Quiz feedback for a committed attempt. Pass the event the repository stored, never a preview. */
export function IngredientReward({ event }: { event: EconomyEvent | null }) {
  if (!event) return null
  if (event.type === 'quiz_incorrect') {
    return <p className={styles.reward} role="status">No ingredient this time. The next correct answer finds one.</p>
  }
  if (event.type !== 'quiz_correct') return null
  const ingredient = ingredientById[event.ingredientId]
  return (
    <div className={styles.reward} role="status">
      <IngredientIcon id={ingredient.id} loading="eager" size={56} />
      <span>
        <strong>Ingredient found</strong>
        <small>+1 {ingredient.name} for your Treat Shelf</small>
      </span>
    </div>
  )
}
