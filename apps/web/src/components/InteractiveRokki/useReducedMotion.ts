import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Reports whether the user prefers reduced motion. Feature-detects
 * `matchMedia` so it is safe under jsdom (which omits it); when the API is
 * unavailable it returns `false`, matching the CSS fallback where animations
 * run normally unless the OS asks otherwise.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => getInitialPreference())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const media = window.matchMedia(QUERY)
    const update = () => setReduced(media.matches)
    update()

    // Safari < 14 only supports the deprecated addListener signature.
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }

    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  return reduced
}

function getInitialPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(QUERY).matches
}
