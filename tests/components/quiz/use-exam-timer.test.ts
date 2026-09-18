import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useExamTimer } from "@/components/quiz/runner/use-exam-timer"

// L'arithmétique (crédit de pause, plafond, clamp, zones) est prouvée par
// `tests/lib/attempt-clock.test.ts` ; ici seuls le tick et ses effets.
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useExamTimer", () => {
  it("décompte et déclenche onExpire à 0", () => {
    const onExpire = vi.fn()
    const start = Date.now()
    const { result } = renderHook(() =>
      useExamTimer({
        serverStartTime: start,
        initialNow: start,
        totalSeconds: 2,
        isPaused: false,
        totalPauseDurationMs: 0,
        onExpire,
      }),
    )
    expect(result.current.remainingMs).toBeGreaterThan(0)
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(result.current.remainingMs).toBe(0)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it("onExpire n'est déclenché qu'une seule fois même après 0", () => {
    const onExpire = vi.fn()
    const start = Date.now()
    renderHook(() =>
      useExamTimer({
        serverStartTime: start,
        initialNow: start,
        totalSeconds: 1,
        isPaused: false,
        totalPauseDurationMs: 0,
        onExpire,
      }),
    )
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it("enabled=false : timer inerte, onExpire JAMAIS déclenché (mode sans chrono)", () => {
    // En entraînement, mode.timer=null → totalSeconds=0 : sans la garde
    // `enabled`, remaining<=0 dès le montage auto-soumettrait la session.
    const onExpire = vi.fn()
    const start = Date.now()
    renderHook(() =>
      useExamTimer({
        enabled: false,
        serverStartTime: start,
        initialNow: start,
        totalSeconds: 0,
        isPaused: false,
        totalPauseDurationMs: 0,
        onExpire,
      }),
    )
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onExpire).not.toHaveBeenCalled()
  })

  it("gelé quand isPaused, reprend au dégel", () => {
    const start = Date.now()
    const { result, rerender } = renderHook(
      ({ p }: { p: boolean }) =>
        useExamTimer({
          serverStartTime: start,
          initialNow: start,
          totalSeconds: 100,
          isPaused: p,
          totalPauseDurationMs: 0,
          onExpire: vi.fn(),
        }),
      { initialProps: { p: true } },
    )
    const before = result.current.remainingMs
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.remainingMs).toBe(before)
    rerender({ p: false })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.remainingMs).toBeLessThan(before)
  })

  it("expose la zone d'alerte de l'horloge", () => {
    const start = Date.now()
    const { result } = renderHook(() =>
      useExamTimer({
        serverStartTime: start,
        initialNow: start,
        totalSeconds: 4 * 60,
        isPaused: false,
        totalPauseDurationMs: 0,
        onExpire: vi.fn(),
      }),
    )
    expect(result.current.isRunningOut).toBe(true)
    expect(result.current.isCritical).toBe(true)
  })
})
