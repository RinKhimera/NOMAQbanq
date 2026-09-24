import { useCallback, useRef, useState } from "react"

type ScrollMetrics = {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}

export type ScrollEdges = { start: boolean; end: boolean }

// Le zoom navigateur rend scrollLeft fractionnaire : au bout du défilement,
// il peut manquer moins d'un pixel.
const TOLERANCE_PX = 1

/** Côtés où il reste du contenu à faire défiler. */
export function scrollEdges({
  scrollLeft,
  scrollWidth,
  clientWidth,
}: ScrollMetrics): ScrollEdges {
  return {
    start: scrollLeft > TOLERANCE_PX,
    end: scrollWidth - clientWidth - scrollLeft > TOLERANCE_PX,
  }
}

const NO_EDGES: ScrollEdges = { start: false, end: false }

/**
 * Suit les côtés défilables d'un conteneur, au défilement comme au
 * redimensionnement. Ref de rappel : le conteneur peut apparaître après le
 * montage (squelette de chargement d'abord).
 */
export function useScrollEdges<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null)
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES)

  const ref = useCallback((element: T | null) => {
    elementRef.current = element
    if (!element) return
    const measure = () => {
      const next = scrollEdges(element)
      setEdges((previous) =>
        previous.start === next.start && previous.end === next.end
          ? previous
          : next,
      )
    }
    measure()
    element.addEventListener("scroll", measure, { passive: true })
    // Observer aussi le tableau : ses colonnes changent de largeur sans que
    // le conteneur, lui, ne change de taille.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => {
      element.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [])

  const scrollBy = useCallback((direction: -1 | 1) => {
    const element = elementRef.current
    if (!element) return
    element.scrollBy({
      left: direction * element.clientWidth * 0.6,
      behavior: "smooth",
    })
  }, [])

  return { ref, edges, scrollBy }
}
