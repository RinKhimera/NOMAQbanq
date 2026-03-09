import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIsMobile } from "@/hooks/use-mobile"

type MatchMediaListener = (event: { matches: boolean }) => void

function createMatchMediaMock(matches: boolean) {
  const listeners: MatchMediaListener[] = []
  const addEventListener = vi.fn(
    (_event: string, cb: MatchMediaListener) => {
      listeners.push(cb)
    },
  )
  const removeEventListener = vi.fn(
    (_event: string, cb: MatchMediaListener) => {
      const idx = listeners.indexOf(cb)
      if (idx !== -1) listeners.splice(idx, 1)
    },
  )

  const mql = {
    matches,
    addEventListener,
    removeEventListener,
    listeners,
  }

  return mql
}

describe("useIsMobile", () => {
  let originalMatchMedia: typeof window.matchMedia
  let originalInnerWidth: number

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    originalInnerWidth = window.innerWidth
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
    vi.restoreAllMocks()
  })

  it("retourne false par defaut (desktop, innerWidth >= 768)", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it("retourne true sur mobile (innerWidth < 768)", () => {
    const mql = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 400,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it("retourne true quand innerWidth vaut exactement 767", () => {
    const mql = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 767,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it("retourne false quand innerWidth vaut exactement 768", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 768,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it("reagit aux changements de media query", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Simuler un redimensionnement vers mobile
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    })

    act(() => {
      for (const listener of mql.listeners) {
        listener({ matches: true })
      }
    })

    expect(result.current).toBe(true)
  })

  it("reagit au passage de mobile vers desktop", () => {
    const mql = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    // Simuler un redimensionnement vers desktop
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })

    act(() => {
      for (const listener of mql.listeners) {
        listener({ matches: false })
      }
    })

    expect(result.current).toBe(false)
  })

  it("cleanup: removeEventListener est appele au demontage", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { unmount } = renderHook(() => useIsMobile())

    expect(mql.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    )

    unmount()

    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    )
  })

  it("addEventListener et removeEventListener recoivent le meme callback", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { unmount } = renderHook(() => useIsMobile())

    const addedCallback = mql.addEventListener.mock.calls[0][1]
    unmount()
    const removedCallback = mql.removeEventListener.mock.calls[0][1]

    expect(addedCallback).toBe(removedCallback)
  })

  it("utilise la bonne media query (max-width: 767px)", () => {
    const mql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })

    renderHook(() => useIsMobile())

    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)")
  })
})
