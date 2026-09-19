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

  it("câble le crédit de pause dans l'horloge : le temps en pause ne décompte pas", () => {
    const now = Date.now()
    const { result } = renderHook(() =>
      useExamTimer({
        serverStartTime: now - 40_000,
        initialNow: now,
        totalSeconds: 60,
        isPaused: false,
        totalPauseDurationMs: 20_000,
        onExpire: vi.fn(),
      }),
    )
    // 40 s écoulées − 20 s de pause = 20 s consommées sur 60.
    expect(result.current.remainingMs).toBe(40_000)
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

describe("useExamTimer — horloge cliente fausse", () => {
  // L'écoulé se mesure par delta monotone depuis l'ancre serveur, jamais par
  // `Date.now()` : un réglage d'horloge système ne doit ni auto-soumettre ni
  // offrir du temps. Sous les faux timers, `performance.now()` avance avec les
  // minuteries et ignore `setSystemTime`, comme une horloge monotone réelle.
  const BUDGET_SECONDS = 3600
  const THREE_HOURS = 3 * 60 * 60 * 1000

  const mount = (onExpire = vi.fn()) => {
    const start = Date.now()
    const hook = renderHook(() =>
      useExamTimer({
        serverStartTime: start,
        initialNow: start,
        totalSeconds: BUDGET_SECONDS,
        isPaused: false,
        totalPauseDurationMs: 0,
        onExpire,
      }),
    )
    return { ...hook, onExpire }
  }

  it("horloge système avancée de +3 h après le montage : le restant ne saute pas à 0, pas d'auto-soumission", () => {
    const { result, onExpire } = mount()
    act(() => {
      vi.setSystemTime(Date.now() + THREE_HOURS)
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remainingMs).toBe(BUDGET_SECONDS * 1000 - 1000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it("jumeau : le temps réel du budget écoulé (minuteries), sans toucher à l'horloge système → onExpire exactement une fois", () => {
    const { result, onExpire } = mount()
    act(() => {
      vi.advanceTimersByTime(BUDGET_SECONDS * 1000 + 10_000)
    })
    expect(result.current.remainingMs).toBe(0)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it("horloge système reculée de −3 h après le montage : le restant continue de décroître, aucun temps gagné", () => {
    const { result } = mount()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const afterOneSecond = result.current.remainingMs
    act(() => {
      vi.setSystemTime(Date.now() - THREE_HOURS)
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remainingMs).toBe(afterOneSecond - 1000)
  })
})

describe("useExamTimer — page rechargée en pause", () => {
  it("l'ancre se pose au montage, pas à la reprise : le crédit de pause ne fait pas bondir le restant", () => {
    // Rechargement 60 s après le début, en pause. 8 min plus tard, reprise :
    // le serveur crédite 8 min de pause, et le temps a bien couru 8 min
    // depuis l'ancre → restant = budget − 60 s, pas budget − 60 s + 8 min.
    const start = Date.now()
    const EIGHT_MINUTES = 8 * 60 * 1000
    const { result, rerender } = renderHook(
      ({ paused, credit }: { paused: boolean; credit: number }) =>
        useExamTimer({
          serverStartTime: start,
          initialNow: start + 60_000,
          totalSeconds: 3600,
          isPaused: paused,
          totalPauseDurationMs: credit,
          onExpire: vi.fn(),
        }),
      { initialProps: { paused: true, credit: 0 } },
    )
    expect(result.current.remainingMs).toBe(3_540_000)
    act(() => {
      vi.advanceTimersByTime(EIGHT_MINUTES)
    })
    rerender({ paused: false, credit: EIGHT_MINUTES })
    expect(result.current.remainingMs).toBe(3_540_000)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remainingMs).toBe(3_539_000)
  })
})
