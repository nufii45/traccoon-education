import type { PantrySummary } from '../pantries/repository'
import { RoundPicker } from './RoundPicker'

/** Choose the pantry for a Practice round. */
export function PracticePicker({ pantries }: { pantries: PantrySummary[] }) {
  return <RoundPicker mode="practice" pantries={pantries} />
}
