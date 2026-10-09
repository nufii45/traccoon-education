import { describe, expect, it } from 'vitest'
import type { PantrySummary } from './repository'
import { groupPantriesByRecency, isManualPantry } from './pantryGroups'

const now = new Date(2026, 9, 10, 15, 0)

const pantry = (id: string, updatedAt: Date, pageCount = 2): PantrySummary => ({
  id,
  title: id,
  sourceName: pageCount === 0 ? 'Written by hand' : `${id}.pdf`,
  pageCount,
  cardCount: 3,
  createdAt: updatedAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
})

describe('groupPantriesByRecency', () => {
  it('splits pantries into today, this week, and earlier by local calendar day', () => {
    const groups = groupPantriesByRecency(
      [
        pantry('this-morning', new Date(2026, 9, 10, 0, 5)),
        pantry('yesterday-late', new Date(2026, 9, 9, 23, 55)),
        pantry('six-days-ago', new Date(2026, 9, 4, 9, 0)),
        pantry('seven-days-ago', new Date(2026, 9, 3, 23, 59)),
      ],
      now,
    )

    expect(groups.map((group) => [group.id, group.label, group.pantries.map((item) => item.id)])).toEqual([
      ['today', 'Today', ['this-morning']],
      ['this-week', 'This week', ['yesterday-late', 'six-days-ago']],
      ['earlier', 'Earlier', ['seven-days-ago']],
    ])
  })

  it('omits empty groups and keeps the repository order inside a group', () => {
    const groups = groupPantriesByRecency(
      [pantry('newer', new Date(2026, 9, 10, 14, 0)), pantry('older', new Date(2026, 9, 10, 9, 0))],
      now,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].pantries.map((item) => item.id)).toEqual(['newer', 'older'])
  })

  it('treats a timestamp ahead of the device clock as today', () => {
    const [group] = groupPantriesByRecency([pantry('clock-skew', new Date(2026, 9, 11, 8, 0))], now)

    expect(group.label).toBe('Today')
  })

  it('returns no groups for no pantries', () => {
    expect(groupPantriesByRecency([], now)).toEqual([])
  })
})

describe('isManualPantry', () => {
  it('identifies a pantry with no source pages as hand-written', () => {
    expect(isManualPantry(pantry('manual', now, 0))).toBe(true)
    expect(isManualPantry(pantry('pdf', now, 3))).toBe(false)
  })
})
