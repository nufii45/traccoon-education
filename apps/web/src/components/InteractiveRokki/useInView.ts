import { useEffect, useRef, useState } from 'react'

export interface InViewOptions {
  /** Fraction of the element that must be visible to count as in view. */
  threshold?: number
  /** Margin around the root, forwarded to IntersectionObserver. */
  rootMargin?: string
  /** Stop observing after the first time the element enters the viewport. */
  once?: boolean
}

export interface InViewResult<T extends Element> {
  ref: (node: T | null) => void
  /** True while the element is intersecting the viewport. */
  inView: boolean
  /** True once the element has entered the viewport at least once. */
  hasEntered: boolean
}

/**
 * Observe whether an element is in the viewport using IntersectionObserver.
 * Feature-detects the API so it is safe under jsdom (which omits it): when the
 * observer is unavailable the element is reported as visible immediately, so
 * entrance/idle animations fall back to their resting, visible state rather
 * than staying hidden.
 */
export function useInView<T extends Element = HTMLElement>({
  threshold = 0.2,
  rootMargin = '0px',
  once = false,
}: InViewOptions = {}): InViewResult<T> {
  const supported =
    typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function'

  const [inView, setInView] = useState(!supported)
  const [hasEntered, setHasEntered] = useState(!supported)
  const nodeRef = useRef<T | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const ref = (node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    nodeRef.current = node
    if (!node || !supported) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        setInView(entry.isIntersecting)
        if (entry.isIntersecting) {
          setHasEntered(true)
          if (once) {
            observer.disconnect()
            observerRef.current = null
          }
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    observerRef.current = observer
  }

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [])

  return { ref, inView, hasEntered }
}
