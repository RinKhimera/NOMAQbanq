import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useExamTimer } from "@/components/quiz/runner/use-exam-timer"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useExamTimer", () => {
  it("décompte et déclenche onExpire à 0", () => {
    const onExpire = vi.fn()
    const start = Date.now()
    const { result } = renderHook(() =>
      useExamTimer({
        serverStartTime: start,
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
    // Régression : en entraînement, mode.timer=null → totalSeconds=0 → sans la
    // garde `enabled`, remaining<=0 au montage auto-soumettait la session.
    const onExpire = vi.fn()
    const start = Date.now()
    renderHook(() =>
      useExamTimer({
        enabled: false,
        serverStartTime: start,
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

  it("gelé quand isPaused", () => {
    const start = Date.now()
    const { result, rerender } = renderHook(
      ({ p }: { p: boolean }) =>
        useExamTimer({
          serverStartTime: start,
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
    expect(result.current.remainingMs).toBe(before) // figé
    // Unpausing should resume
    rerender({ p: false })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    // After unpause and 3 more seconds elapsed (fake time ran while paused, but
    // totalPauseDurationMs=0 so the hook measures from serverStartTime - that's
    // the expected behavior: pause duration tracking is done server-side)
    expect(result.current.remainingMs).toBeLessThan(before)
  })

  it("isRunningOut est vrai quand moins de 10 min restantes", () => {
    const start = Date.now()
    const onExpire = vi.fn()
    const { result } = renderHook(() =>
      useExamTimer({
        serverStartTime: start,
        totalSeconds: 9 * 60, // 9 min total → already running out
        isPaused: false,
        totalPauseDurationMs: 0,
        onExpire,
      }),
    )
    expect(result.current.isRunningOut).toBe(true)
    expect(result.current.isCritical).toBe(false)
  })

  it("isCritical est vrai quand moins de 5 min restantes", () => {
    const start = Date.now()
    const onExpire = vi.fn()
    const { result } = renderHook(() =>
      useExamTimer({
        serverStartTime: start,
        totalSeconds: 4 * 60, // 4 min total → already critical
        isPaused: false,
        totalPauseDurationMs: 0,
        onExpire,
      }),
    )
    expect(result.current.isCritical).toBe(true)
  })

  it("prend en compte totalPauseDurationMs pour le calcul", () => {
    const start = Date.now()
    const onExpire = vi.fn()
    // total 60s, 20s of pause already accumulated
    // effective elapsed at t=0 is: (now - start - 20000) = -20000 → remaining = 60000 + 20000 = 80000
    const { result } = renderHook(() =>
      useExamTimer({
        serverStartTime: start,
        totalSeconds: 60,
        isPaused: false,
        totalPauseDurationMs: 20 * 1000,
        onExpire,
      }),
    )
    // remaining = 60000 - (0 - 20000) = 80000
    expect(result.current.remainingMs).toBeGreaterThan(60 * 1000)
    expect(onExpire).not.toHaveBeenCalled()
  })
})
