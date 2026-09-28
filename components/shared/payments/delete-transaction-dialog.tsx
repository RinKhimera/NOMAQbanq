"use client"

import { CircleHelp, Info, Trash2, TriangleAlert } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Spinner } from "@/components/ui/spinner"
import { deleteManualTransaction } from "@/features/payments/actions"
import { formatCurrency, formatShortDate } from "@/lib/format"
import { describeAccessImpact } from "./access-impact"
import type { Transaction } from "./transaction-table"
import { useAccessImpact } from "./use-access-impact"

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
  // Purement informatif : la suppression recalcule l'accès sous verrou.
  const impact = useAccessImpact(transaction?._id ?? null, open)

  const handleDelete = async () => {
    if (!transaction) return false
    try {
      const result = await deleteManualTransaction(transaction._id)
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de la suppression")
        return false
      }
      toast.success(
        result.accessRevoked
          ? "Transaction supprimée — accès recalculé"
          : "Transaction supprimée",
      )
      onSuccess?.()
    } catch (error) {
      toast.error("Erreur lors de la suppression")
      console.error(error)
      return false
    }
  }

  if (!transaction) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Trash2}
      variant="destructive"
      title="Supprimer cette transaction ?"
      description="Cette action est irréversible."
      confirmLabel="Supprimer"
      pendingLabel="Suppression..."
      confirmDisabled={impact.status === "loading"}
      onConfirm={handleDelete}
    >
      <div className="my-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">
              Utilisateur
            </span>
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

      {impact.status === "loading" ? (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
          <Spinner size="sm" />
          Calcul de l{"'"}impact sur l{"'"}accès…
        </div>
      ) : impact.status === "failed" ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <CircleHelp className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Impact sur l{"'"}accès indisponible
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              La suppression recalculera l{"'"}accès de l{"'"}utilisateur ;
              vérifiez-le après coup.
            </p>
          </div>
        </div>
      ) : impact.affected.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20"
        >
          <TriangleAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">
              Impact sur l{"'"}accès
            </p>
            {impact.affected.map((a) => (
              <p
                key={a.accessType}
                className="mt-1 text-sm text-red-700 dark:text-red-300"
              >
                {describeAccessImpact(a, "La suppression", impact.loadedAt)}
              </p>
            ))}
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
              L{"'"}accès de l{"'"}utilisateur ne sera pas affecté car d{"'"}
              autres transactions plus récentes maintiennent son accès actif.
            </p>
          </div>
        </motion.div>
      )}
    </ConfirmDialog>
  )
}
