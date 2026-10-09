import type { PantrySummary } from './repository'

export type PantryRecencyLabel = 'Today' | 'This week' | 'Earlier'

export interface PantryGroup {
  /** Whitespace-free key, safe for element ids and `aria-labelledby`. */
  id: string
  label: PantryRecencyLabel
  pantries: PantrySummary[]
}

const DAYS_IN_WEEK = 7

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const recencyLabel = (updatedAt: Date, now: Date): PantryRecencyLabel => {
  const today = startOfLocalDay(now)
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS_IN_WEEK - 1))

  if (updatedAt >= today) {
    return 'Today'
  }

  return updatedAt >= weekStart ? 'This week' : 'Earlier'
}

/**
 * Groups pantry summaries by when they were last updated, using the device's
 * local calendar: today, the six days before it, then everything older.
 * Empty groups are omitted and each group keeps the input order.
 */
export const groupPantriesByRecency = (pantries: PantrySummary[], now: Date = new Date()): PantryGroup[] => {
  const order: PantryRecencyLabel[] = ['Today', 'This week', 'Earlier']

  return order
    .map((label) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      pantries: pantries.filter((pantry) => recencyLabel(new Date(pantry.updatedAt), now) === label),
    }))
    .filter((group) => group.pantries.length > 0)
}

/** A PDF pantry always stores at least one source page; a hand-written one stores none. */
export const isManualPantry = (pantry: Pick<PantrySummary, 'pageCount'>) => pantry.pageCount === 0
