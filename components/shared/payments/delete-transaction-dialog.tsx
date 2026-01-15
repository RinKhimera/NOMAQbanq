"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { motion } from "motion/react"
import { Trash2, AlertTriangle, Loader2, Info } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { formatCurrency, formatShortDate } from "@/lib/format"
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
import type { Transaction } from "./transaction-table"

interface DeleteTransactionDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const DeleteTransactionDialog = ({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: DeleteTransactionDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteTransaction = useMutation(api.payments.deleteManualTransaction)
  const accessImpact = useQuery(
    api.payments.getTransactionAccessImpact,
    transaction ? { transactionId: transaction._id as Id<"transactions"> } : "skip"
  )

  const handleDelete = async () => {
    if (!transaction) return

    setIsDeleting(true)
    try {
      const result = await deleteTransaction({
        transactionId: transaction._id as Id<"transactions">,
      })

      const message = result.accessRevoked
        ? "Transaction supprimée et accès révoqué"
        : "Transaction supprimée"
      toast.success(message)

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(errorMessage)
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!transaction) return null

  const willRevokeAccess = accessImpact?.willRevokeAccess ?? false

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Supprimer cette transaction ?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Transaction Details */}
        <div className="my-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Utilisateur</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {transaction.user?.name || "Inconnu"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Produit</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {transaction.product?.name || "Inconnu"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Montant</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(transaction.amountPaid, transaction.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Date</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatShortDate(transaction.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Access Impact Warning */}
        {willRevokeAccess ? (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                Révocation d{"'"}accès
              </p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                Cette suppression révoquera l{"'"}accès{" "}
                {accessImpact?.accessType === "exam" ? "aux examens" : "à l'entraînement"}{" "}
                de l{"'"}utilisateur car c{"'"}est sa dernière transaction pour ce type d{"'"}accès.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20"
          >
            <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Accès non affecté
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                L{"'"}accès de l{"'"}utilisateur ne sera pas affecté car d{"'"}autres transactions plus récentes maintiennent son accès actif.
              </p>
            </div>
          </motion.div>
        )}

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
