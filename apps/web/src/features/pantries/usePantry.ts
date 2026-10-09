import { useEffect, useState } from 'react'
import { pantryRepository, type Pantry } from './repository'

/**
 * Loads one pantry for the current route. `undefined` while loading, `null`
 * when the id does not exist on this device.
 */
export function usePantry(pantryId: string) {
  const [pantry, setPantry] = useState<Pantry | null>()

  const reload = async () => {
    setPantry((await pantryRepository.getPantry(pantryId)) ?? null)
  }

  useEffect(() => {
    let isActive = true
    setPantry(undefined)
    pantryRepository.getPantry(pantryId).then((loaded) => {
      if (isActive) setPantry(loaded ?? null)
    })
    return () => {
      isActive = false
    }
  }, [pantryId])

  return { pantry, reload }
}
