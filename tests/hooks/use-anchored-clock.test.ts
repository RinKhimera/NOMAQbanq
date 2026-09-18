import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAnchoredClock } from "@/hooks/use-anchored-clock"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useAnchoredClock", () => {
  const ANCHOR = 1_700_000_000_000

  it("lit l'ancre à la première lecture puis avance par delta monotone, insensible à l'horloge système", () => {
    const { result } = renderHook(() => useAnchoredClock(ANCHOR))
    expect(result.current()).toBe(ANCHOR)
    vi.advanceTimersByTime(2500)
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000)
    expect(result.current()).toBe(ANCHOR + 2500)
  })

  it("ne pose l'ancre qu'à la lecture, jamais au rendu : le temps écoulé avant la première lecture n'est pas compté", () => {
    const { result } = renderHook(() => useAnchoredClock(ANCHOR))
    vi.advanceTimersByTime(5000)
    expect(result.current()).toBe(ANCHOR)
  })

  it("une nouvelle ancre serveur repose le delta", () => {
    const { result, rerender } = renderHook(
      ({ anchor }: { anchor: number }) => useAnchoredClock(anchor),
      { initialProps: { anchor: ANCHOR } },
    )
    result.current()
    vi.advanceTimersByTime(60_000)
    rerender({ anchor: ANCHOR + 90_000 })
    expect(result.current()).toBe(ANCHOR + 90_000)
    vi.advanceTimersByTime(1000)
    expect(result.current()).toBe(ANCHOR + 91_000)
  })
})
