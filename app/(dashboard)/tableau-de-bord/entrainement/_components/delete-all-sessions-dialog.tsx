"use client"

import { Trash2, TriangleAlert } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { deleteAllTrainingSessions } from "@/features/training/actions"

interface DeleteAllSessionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const DeleteAllSessionsDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: DeleteAllSessionsDialogProps) => {
  const handleDelete = async () => {
    try {
      const result = await deleteAllTrainingSessions()
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de la suppression")
        return false
      }
      toast.success(
        `${result.deletedCount} session${result.deletedCount > 1 ? "s" : ""} supprimée${result.deletedCount > 1 ? "s" : ""}`,
      )
      onSuccess?.()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      toast.error(errorMessage)
      console.error(error)
      return false
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Trash2}
      variant="destructive"
      title="Supprimer tout l'historique ?"
      description="Cette action est irréversible."
      confirmLabel="Tout supprimer"
      pendingLabel="Suppression..."
      onConfirm={handleDelete}
    >
      {/* Warning */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="my-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20"
      >
        <TriangleAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div>
          <p className="font-medium text-red-800 dark:text-red-200">
            Suppression définitive
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Toutes vos sessions d{"'"}entraînement terminées seront
            définitivement supprimées. Cette action ne peut pas être annulée.
          </p>
        </div>
      </motion.div>
    </ConfirmDialog>
  )
}
