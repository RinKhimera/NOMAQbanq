import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useMediaQuery } from "@/hooks/use-media-query"

type ChangeCallback = () => void

function createMatchMediaMock(matches: boolean) {
  const listeners: ChangeCallback[] = []

  return {
    matches,
    addEventListener: vi.fn((_event: string, cb: ChangeCallback) => {
      listeners.push(cb)
    }),
    removeEventListener: vi.fn((_event: string, cb: ChangeCallback) => {
      const idx = listeners.indexOf(cb)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    listeners,
    setMatches(value: boolean) {
      this.matches = value
    },
  }
}

describe("useMediaQuery", () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it("retourne true quand la media query match", () => {
    const mql = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"))

    expect(result.current).toBe(true)
  })

  it("retourne false quand la media query ne match pas", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"))

    expect(result.current).toBe(false)
  })

  it("reagit aux changements de media query", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"))

    expect(result.current).toBe(false)

    // Simuler le changement : la media query match maintenant
    mql.setMatches(true)

    // Declencher les callbacks d'abonnement pour que
    // useSyncExternalStore rappelle getSnapshot
    act(() => {
      for (const listener of mql.listeners) {
        listener()
      }
    })

    expect(result.current).toBe(true)
  })

  it("passe la bonne query string a matchMedia", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    renderHook(() => useMediaQuery("(prefers-color-scheme: dark)"))

    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)",
    )
  })

  it("s'abonne aux changements via addEventListener", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    renderHook(() => useMediaQuery("(min-width: 768px)"))

    expect(mql.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    )
  })

  it("se desabonne via removeEventListener au demontage", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"))

    unmount()

    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    )
  })

  it("fonctionne avec differentes media queries", () => {
    const mqlDark = createMatchMediaMock(true)
    const mqlWidth = createMatchMediaMock(false)

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      if (query === "(prefers-color-scheme: dark)") return mqlDark
      return mqlWidth
    })

    const { result: darkResult } = renderHook(() =>
      useMediaQuery("(prefers-color-scheme: dark)"),
    )
    const { result: widthResult } = renderHook(() =>
      useMediaQuery("(min-width: 1200px)"),
    )

    expect(darkResult.current).toBe(true)
    expect(widthResult.current).toBe(false)
  })
})
