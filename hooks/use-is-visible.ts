"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Tracks whether a DOM element is visible in the viewport using IntersectionObserver.
 * Uses a callback ref so it works even when the element mounts after initial render
 * (e.g. after data loads).
 */
export function useIsVisible() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  const ref = useCallback((node: HTMLElement | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { ref, isVisible }
}
