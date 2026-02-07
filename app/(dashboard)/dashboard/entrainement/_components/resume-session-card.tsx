"use client"

import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Play, X, Clock, AlertCircle, Loader2 } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

interface ResumeSessionCardProps {
  session: Doc<"trainingParticipations">
  remainingTimeMs: number
}

const formatTimeRemaining = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes} minutes`
}

export const ResumeSessionCard = ({
  session,
  remainingTimeMs: initialRemainingTime,
}: ResumeSessionCardProps) => {
  const router = useRouter()
  const [remainingTime, setRemainingTime] = useState(initialRemainingTime)
  const [isAbandoning, setIsAbandoning] = useState(false)

  const abandonSession = useMutation(api.training.abandonTrainingSession)

  // Update remaining time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime((prev) => Math.max(0, prev - 60000))
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const handleResume = () => {
    router.push(`/dashboard/entrainement/${session._id}`)
  }

  const handleAbandon = async () => {
    setIsAbandoning(true)
    try {
      await abandonSession({ sessionId: session._id })
      toast.success("Session abandonnée", {
        description: "Vous pouvez maintenant commencer une nouvelle session",
      })
      // Page will re-render automatically via Convex reactivity
    } catch (error) {
      toast.error("Erreur", {
        description:
          error instanceof Error ? error.message : "Une erreur est survenue",
      })
    } finally {
      setIsAbandoning(false)
    }
  }

  const isLowTime = remainingTime < 2 * 60 * 60 * 1000 // Less than 2 hours

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl border-2 border-amber-300/60 bg-linear-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-lg dark:border-amber-700/40 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-yellow-950/40"
    >
      {/* Decorative pulse */}
      <div className="absolute right-4 top-4">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
      </div>

      <div className="p-6">
        {/* Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <AlertCircle className="h-4 w-4" />
          Session en cours
        </div>

        {/* Session info */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-amber-700/70 dark:text-amber-300/70">
              Questions
            </p>
            <p className="font-display text-2xl font-bold text-amber-900 dark:text-amber-100">
              {session.questionCount}
            </p>
          </div>
          <div>
            <p className="text-sm text-amber-700/70 dark:text-amber-300/70">
              Domaine
            </p>
            <p className="font-display text-lg font-semibold text-amber-900 dark:text-amber-100">
              {session.domain ?? "Tous les domaines"}
            </p>
          </div>
        </div>

        {/* Time remaining */}
        <div
          className={`mb-6 flex items-center gap-2 rounded-xl p-3 ${
            isLowTime
              ? "bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-200"
              : "bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          }`}
        >
          <Clock className="h-5 w-5" />
          <span className="text-sm">
            Expire dans{" "}
            <span className="font-semibold">
              {formatTimeRemaining(remainingTime)}
            </span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleResume}
            className="flex-1 bg-linear-to-r from-amber-500 to-orange-500 font-semibold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600"
          >
            <Play className="mr-2 h-4 w-4" />
            Reprendre
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                aria-label="Abandonner la session"
                className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                disabled={isAbandoning}
              >
                {isAbandoning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abandonner la session ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Votre progression actuelle sera
                  perdue et vous pourrez démarrer une nouvelle session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAbandon}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Abandonner
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </motion.div>
  )
}
