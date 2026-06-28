"use client"

import { Coffee, Play, Timer } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  calculatePauseTimeRemaining,
  formatPauseTime,
  isPauseExpired,
} from "@/lib/exam-timer"
import { cn } from "@/lib/utils"

interface PauseDialogProps {
  isOpen: boolean
  onResume: () => void
  pauseStartedAt: number | undefined
  pauseDurationMinutes: number
  isResuming?: boolean
}

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
  isResuming = false,
}: PauseDialogProps) => {
  const [pauseTimeRemaining, setPauseTimeRemaining] = useState(0)

  // Derive progress from pauseTimeRemaining (no need for separate state)
  const totalPauseMs = pauseDurationMinutes * 60 * 1000
  const progress =
    totalPauseMs > 0
      ? ((totalPauseMs - pauseTimeRemaining) / totalPauseMs) * 100
      : 0

  // Update pause countdown
  useEffect(() => {
    if (!isOpen || !pauseStartedAt) return

    const updatePauseTime = () => {
      const remaining = calculatePauseTimeRemaining(
        pauseStartedAt,
        pauseDurationMinutes,
      )
      setPauseTimeRemaining(remaining)

      // Auto-resume when pause timer expires
      if (isPauseExpired(pauseStartedAt, pauseDurationMinutes)) {
        onResume()
      }
    }

    updatePauseTime()
    const timer = setInterval(updatePauseTime, 1000)

    return () => clearInterval(timer)
  }, [isOpen, pauseStartedAt, pauseDurationMinutes, onResume])

  if (!isOpen) return null

  const isPauseAlmostOver = pauseTimeRemaining < 60 * 1000 // Less than 1 minute

  return (
    <div
      data-testid="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Pause de repos"
      className="bg-background fixed inset-0 z-60 flex items-center justify-center overflow-y-auto p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg space-y-6"
      >
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
            >
              <Coffee className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </motion.div>
          </div>
          <h2 className="text-2xl font-bold">Pause de repos</h2>
          <p className="text-muted-foreground text-base">
            Prenez une pause bien méritée. Le chronomètre de l&apos;examen est
            gelé pendant ce temps.
          </p>
        </div>

        {/* Timer Display */}
        <div className="text-center">
          <div
            data-testid="pause-timer"
            className={cn(
              "inline-flex items-center gap-3 rounded-2xl px-6 py-4 font-mono text-4xl font-bold transition-colors",
              isPauseAlmostOver
                ? "animate-pulse bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
            )}
          >
            <Timer
              className={cn(
                "h-8 w-8",
                isPauseAlmostOver
                  ? "text-amber-600"
                  : "text-blue-600 dark:text-blue-400",
              )}
            />
            {formatPauseTime(pauseTimeRemaining)}
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Temps de pause restant
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>Progression de la pause</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Tips */}
        <div className="bg-muted/50 rounded-lg border p-4">
          <h3 className="mb-2 font-medium">💡 Conseils pendant la pause</h3>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>• Étirez-vous et reposez vos yeux</li>
            <li>• Buvez de l&apos;eau pour rester hydraté</li>
            <li>• Vous pouvez reprendre à tout moment</li>
          </ul>
        </div>

        {/* Resume button */}
        <Button
          onClick={onResume}
          disabled={isResuming}
          size="lg"
          data-testid="btn-resume-exam"
          className="w-full bg-linear-to-r from-green-600 to-emerald-600 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
        >
          {isResuming ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Reprise en cours...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Reprendre l&apos;examen
            </>
          )}
        </Button>
      </motion.div>
    </div>
  )
}

export default PauseDialog
