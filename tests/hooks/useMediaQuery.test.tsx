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
  })

  it.each([true, false])(
    "rend l'état courant de la media query (%s)",
    (matches) => {
      window.matchMedia = vi.fn().mockReturnValue(createMatchMediaMock(matches))

      const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"))

      expect(result.current).toBe(matches)
    },
  )

  it("réagit aux changements de media query", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"))

    expect(result.current).toBe(false)

    mql.setMatches(true)
    // useSyncExternalStore ne relit getSnapshot qu'à l'appel de ses abonnés.
    act(() => {
      for (const listener of mql.listeners) {
        listener()
      }
    })

    expect(result.current).toBe(true)
  })

  it("se désabonne au démontage de l'écouteur posé au montage", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"))
    expect(mql.listeners).toHaveLength(1)
    const [listener] = mql.listeners

    unmount()

    expect(mql.removeEventListener).toHaveBeenCalledWith("change", listener)
    expect(mql.listeners).toHaveLength(0)
  })

  it("interroge matchMedia avec la query reçue", () => {
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
