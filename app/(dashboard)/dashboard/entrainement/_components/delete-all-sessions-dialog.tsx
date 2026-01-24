"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { motion } from "motion/react"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { api } from "@/convex/_generated/api"
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
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteAllSessions = useMutation(api.training.deleteAllTrainingSessions)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteAllSessions({})
      toast.success(
        `${result.deletedCount} session${result.deletedCount > 1 ? "s" : ""} supprimée${result.deletedCount > 1 ? "s" : ""}`,
      )
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
            Supprimer tout l{"'"}historique ?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="my-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
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
              "Tout supprimer"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
