"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { motion } from "motion/react"
import { Trash2, AlertTriangle, Loader2, Target } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

interface Session {
  _id: Id<"trainingParticipations">
  questionCount: number
  score: number
  domain?: string
  completedAt?: number
}

interface DeleteSessionDialogProps {
  session: Session | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

export const DeleteSessionDialog = ({
  session,
  open,
  onOpenChange,
  onSuccess,
}: DeleteSessionDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteSession = useMutation(api.training.deleteTrainingSession)

  const handleDelete = async () => {
    if (!session) return

    setIsDeleting(true)
    try {
      await deleteSession({ sessionId: session._id })
      toast.success("Session supprimée")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      toast.error(errorMessage)
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!session) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
          >
            <Trash2 className="h-7 w-7 text-red-600 dark:text-red-400" />
          </motion.div>
          <AlertDialogTitle className="text-center text-xl">
            Supprimer cette session ?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Session Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="my-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Score</span>
              <span className={`font-bold ${getScoreColor(session.score)}`}>
                {session.score}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Questions</span>
              <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
                <Target className="h-3.5 w-3.5 text-gray-400" />
                {session.questionCount}
              </span>
            </div>
            {session.domain && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Domaine</span>
                <span className="rounded-md bg-gray-200/60 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700/60 dark:text-gray-300">
                  {session.domain}
                </span>
              </div>
            )}
            {session.completedAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Date</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDistanceToNow(new Date(session.completedAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Suppression définitive
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Les données de cette session (score, réponses) seront définitivement
              supprimées et ne pourront pas être récupérées.
            </p>
          </div>
        </motion.div>

        <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
          <AlertDialogCancel className="flex-1 rounded-xl">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 rounded-xl bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Suppression...
              </span>
            ) : (
              "Supprimer"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
