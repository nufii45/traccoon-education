import type { PantrySummary } from '../pantries/repository'
import { RoundPicker } from './RoundPicker'

/** Choose the pantry for a Quiz round. */
export function QuizPicker({ pantries }: { pantries: PantrySummary[] }) {
  return <RoundPicker mode="quiz" pantries={pantries} />
}
