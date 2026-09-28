"use client"

import { Pause, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAnchoredClock } from "@/hooks/use-anchored-clock"
import { formatPauseTime, pauseRemainingMs } from "@/lib/attempt-clock"
import { cn } from "@/lib/utils"

interface PauseDialogProps {
  isOpen: boolean
  onResume: () => void
  pauseStartedAt: number | undefined
  pauseDurationMinutes: number
  /**
   * Dernier instant serveur connu : celui du rendu (ancre du premier rendu,
   * SSR et hydratation, quand la page se charge déjà en pause), puis celui des
   * actions et de la resync au réveil — une nouvelle valeur réaligne le
   * décompte après une veille. Absente, le début de la pause sert d'ancre : le
   * décompte part du plafond. Les ticks avancent par delta monotone depuis
   * l'ancre (`useAnchoredClock`), jamais par `Date.now()`.
   */
  initialNow?: number
  isResuming?: boolean
  /** Chrono de l'examen, figé pendant la pause (hh:mm:ss). */
  examTimeLabel?: string
}

const MINUTE_MS = 60 * 1000

/**
 * Full-screen OPAQUE blocking overlay shown during a rest pause.
 * It fully occludes the question area AND navigator — no question content is
 * readable while the exam clock is frozen. The break time counts down (capped at
 * `pauseDurationMinutes`) and auto-resumes at 0; the user may resume early.
 */
export const PauseDialog = ({
  isOpen,
  onResume,
  pauseStartedAt,
  pauseDurationMinutes,
  initialNow,
  isResuming = false,
  examTimeLabel,
}: PauseDialogProps) => {
  const [pauseTimeRemaining, setPauseTimeRemaining] = useState(() =>
    pauseStartedAt === undefined
      ? 0
      : pauseRemainingMs(
          { startedAt: pauseStartedAt, capMinutes: pauseDurationMinutes },
          initialNow ?? pauseStartedAt,
        ),
  )
  // L'auto-resume tourne dans un interval 1 s : sans one-shot, une reprise qui
  // échoue (réseau coupé) re-déclencherait onResume — et son toast d'erreur —
  // à chaque tick. La garde est la CLÉ de la pause (pauseStartedAt), jamais
  // remise à zéro : un booléen resetté en tête d'effet ne tient pas, `onResume`
  // (inline, recréé à chaque render du runner) ré-exécute l'effet pendant que
  // le premier resume est en vol. En cas d'échec, le bouton reste la voie de
  // retentative.
  const autoResumeFiredForRef = useRef<number | undefined>(undefined)
  const now = useAnchoredClock(initialNow ?? pauseStartedAt ?? 0)

  useEffect(() => {
    if (!isOpen || !pauseStartedAt) return

    const updatePauseTime = () => {
      const remaining = pauseRemainingMs(
        { startedAt: pauseStartedAt, capMinutes: pauseDurationMinutes },
        now(),
      )
      setPauseTimeRemaining(remaining)

      // Auto-resume when pause timer expires (one-shot par clé de pause)
      if (remaining <= 0 && autoResumeFiredForRef.current !== pauseStartedAt) {
        autoResumeFiredForRef.current = pauseStartedAt
        onResume()
      }
    }

    updatePauseTime()
    const timer = setInterval(updatePauseTime, 1000)

    return () => clearInterval(timer)
  }, [isOpen, pauseStartedAt, pauseDurationMinutes, onResume, now])

  if (!isOpen) return null

  return (
    <div
      data-testid="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      className="bg-background fixed inset-0 z-60 grid place-items-center overflow-y-auto p-6"
    >
      <div className="flex max-w-105 flex-col items-center gap-3.5 text-center">
        <Pause aria-hidden className="text-ink-3 size-6" />
        <h2
          id="pause-title"
          className="font-serif text-[32px] leading-tight font-semibold"
        >
          Examen en pause
        </h2>
        <div
          data-testid="pause-timer"
          role="timer"
          aria-label="Temps de pause restant"
          className={cn(
            "font-mono text-[40px] tabular-nums",
            pauseTimeRemaining < MINUTE_MS ? "text-warning-ink" : "text-ink",
          )}
        >
          {formatPauseTime(pauseTimeRemaining)}
        </div>
        <p className="text-ink-2 text-[15px] leading-relaxed">
          {examTimeLabel ? (
            <>
              Le chronomètre de l&apos;examen est arrêté à{" "}
              <span className="text-ink font-mono">{examTimeLabel}</span>.
            </>
          ) : (
            "Le chronomètre de l'examen est arrêté."
          )}{" "}
          L&apos;examen reprend automatiquement à la fin de la pause. C&apos;est
          votre seule pause pour cet examen.
        </p>
        <Button
          onClick={onResume}
          disabled={isResuming}
          size="lg"
          data-testid="btn-resume-exam"
          className="mt-2"
        >
          {isResuming ? <Spinner size="sm" /> : <Play aria-hidden />}
          {isResuming ? "Reprise en cours…" : "Reprendre maintenant"}
        </Button>
      </div>
    </div>
  )
}

export default PauseDialog
