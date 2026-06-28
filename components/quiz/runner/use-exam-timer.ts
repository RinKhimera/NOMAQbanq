import { useCallback, useEffect, useRef, useState } from "react"
import { isTimeCritical, isTimeRunningOut } from "@/lib/exam-timer"

export type UseExamTimerOptions = {
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
    if (isPaused) return

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
  }, [isPaused, computeRemaining])

  return {
    remainingMs,
    isRunningOut: isTimeRunningOut(remainingMs),
    isCritical: isTimeCritical(remainingMs),
  }
}
