"use client"

import { Target, Trash2, TriangleAlert } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { RelativeTime } from "@/components/shared/relative-time"
import { deleteTrainingSession } from "@/features/training/actions"
import { formatScore, scoreTextClass } from "@/lib/score"

interface Session {
  id: string
  questionCount: number
  score: number | null
  domain?: string | null
  completedAt?: number | null
}

interface DeleteSessionDialogProps {
  session: Session | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const DeleteSessionDialog = ({
  session,
  open,
  onOpenChange,
  onSuccess,
}: DeleteSessionDialogProps) => {
  const handleDelete = async () => {
    if (!session) return false
    try {
      const res = await deleteTrainingSession({ sessionId: session.id })
      if (!res.success) {
        toast.error(res.error ?? "Erreur lors de la suppression")
        return false
      }
      toast.success("Session supprimée")
      onSuccess?.()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      toast.error(errorMessage)
      console.error(error)
      return false
    }
  }

  if (!session) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Trash2}
      variant="destructive"
      title="Supprimer cette session ?"
      description="Cette action est irréversible."
      confirmLabel="Supprimer"
      pendingLabel="Suppression..."
      onConfirm={handleDelete}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="my-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Score</span>
            <span className={`font-bold ${scoreTextClass(session.score)}`}>
              {formatScore(session.score)}
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
                <RelativeTime timestamp={session.completedAt} />
              </span>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20"
      >
        <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
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
    </ConfirmDialog>
  )
}
