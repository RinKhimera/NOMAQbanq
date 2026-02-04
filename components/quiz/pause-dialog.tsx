"use client"

import { Coffee, Lock, Play, Timer, Unlock } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  totalQuestions: number
  midpoint: number
  isResuming?: boolean
}

export const PauseDialog = ({
  isOpen,
  onResume,
  pauseStartedAt,
  pauseDurationMinutes,
  totalQuestions,
  midpoint,
  isResuming = false,
}: PauseDialogProps) => {
  const [pauseTimeRemaining, setPauseTimeRemaining] = useState(0)

  // Derive progress from pauseTimeRemaining (no need for separate state)
  const totalPauseMs = pauseDurationMinutes * 60 * 1000
  const progress =
    totalPauseMs > 0 ? ((totalPauseMs - pauseTimeRemaining) / totalPauseMs) * 100 : 0

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

  const isPauseAlmostOver = pauseTimeRemaining < 60 * 1000 // Less than 1 minute

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
            >
              <Coffee className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </motion.div>
            Pause obligatoire
          </DialogTitle>
          <DialogDescription className="text-base">
            Prenez une pause bien méritée avant de continuer l&apos;examen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Timer Display */}
          <div className="text-center">
            <div
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
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Temps de pause restant
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Progression de la pause</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Information Cards */}
          <div className="grid gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-900/20"
            >
              <Unlock className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Première moitié complétée
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Questions 1 à {midpoint} accessibles et répondues
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20"
            >
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Seconde moitié verrouillée
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Questions {midpoint + 1} à {totalQuestions} seront
                  déverrouillées après la pause
                </p>
              </div>
            </motion.div>
          </div>

          {/* Tips */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-2 font-medium text-gray-900 dark:text-white">
              💡 Conseils pendant la pause
            </h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• Étirez-vous et reposez vos yeux</li>
              <li>• Buvez de l&apos;eau pour rester hydraté</li>
              <li>• Le timer de l&apos;examen continue en arrière-plan</li>
              <li>• Vous pouvez reprendre à tout moment</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onResume}
            disabled={isResuming}
            size="lg"
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PauseDialog
