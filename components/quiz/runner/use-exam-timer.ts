import { useCallback, useEffect, useRef, useState } from "react"
import { isTimeCritical, isTimeRunningOut } from "@/lib/exam-timer"

export type UseExamTimerOptions = {
  /**
   * Quand false, le timer est inerte : aucun décompte, `onExpire` n'est JAMAIS
   * déclenché. Indispensable pour les modes sans timer (entraînement) où
   * `totalSeconds` vaut 0 — sinon `remaining <= 0` au montage auto-soumettrait
   * la session immédiatement. Défaut true (mode examen chronométré).
   */
  enabled?: boolean
  serverStartTime: number
  totalSeconds: number
  isPaused: boolean
  totalPauseDurationMs: number
  onExpire: () => void
}

export type UseExamTimerResult = {
  remainingMs: number
  isRunningOut: boolean
  isCritical: boolean
}

export function useExamTimer({
  enabled = true,
  serverStartTime,
  totalSeconds,
  isPaused,
  totalPauseDurationMs,
  onExpire,
}: UseExamTimerOptions): UseExamTimerResult {
  const computeRemaining = useCallback(() => {
    const now = Date.now()
    const elapsed = now - serverStartTime - totalPauseDurationMs
    return Math.max(0, totalSeconds * 1000 - elapsed)
  }, [serverStartTime, totalSeconds, totalPauseDurationMs])

  const [remainingMs, setRemainingMs] = useState<number>(computeRemaining)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  })

  useEffect(() => {
    // Timer inerte (mode sans chrono) ou en pause : ne pas décompter ni expirer.
    if (!enabled || isPaused) return

    // Tick immediately to pick up any changes (e.g. after resume updates totalPauseDurationMs)
    // and then on interval
    const tick = () => {
      const remaining = computeRemaining()
      setRemainingMs(remaining)
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpireRef.current()
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [enabled, isPaused, computeRemaining])

  return {
    remainingMs,
    isRunningOut: isTimeRunningOut(remainingMs),
    isCritical: isTimeCritical(remainingMs),
  }
}
