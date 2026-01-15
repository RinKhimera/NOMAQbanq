"use client"

import { motion } from "motion/react"
import {
  CreditCard,
  Banknote,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  ChevronDown,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatShortDate, formatTimeOnly } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

type TransactionStatus = "pending" | "completed" | "failed" | "refunded"
type TransactionType = "stripe" | "manual"

interface Transaction {
  _id: string
  type: TransactionType
  status: TransactionStatus
  amountPaid: number
  currency: string
  accessType: "exam" | "training"
  durationDays: number
  createdAt: number
  completedAt?: number
  paymentMethod?: string
  notes?: string
  product?: { _id: string; name: string } | null
  user?: { _id: string; name: string; email: string } | null
}

interface TransactionTableProps {
  transactions: Transaction[]
  showUserColumn?: boolean
  isLoading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  emptyMessage?: string
  onEditTransaction?: (transaction: Transaction) => void
  onDeleteTransaction?: (transaction: Transaction) => void
}

export type { Transaction }

const statusConfig: Record<TransactionStatus, {
  label: string
  icon: typeof CheckCircle
  className: string
}> = {
  completed: {
    label: "Complété",
    icon: CheckCircle,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  pending: {
    label: "En attente",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  failed: {
    label: "Échoué",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  refunded: {
    label: "Remboursé",
    icon: RotateCcw,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
}

const typeConfig: Record<TransactionType, {
  label: string
  icon: typeof CreditCard
  className: string
}> = {
  stripe: {
    label: "Stripe",
    icon: CreditCard,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  manual: {
    label: "Manuel",
    icon: Banknote,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
}

const StatusBadge = ({ status }: { status: TransactionStatus }) => {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      config.className
    )}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

const TypeBadge = ({ type }: { type: TransactionType }) => {
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      config.className
    )}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

const TableSkeleton = ({ rows = 5, showUserColumn = false }: { rows?: number; showUserColumn?: boolean }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        {showUserColumn && <Skeleton className="h-4 w-28" />}
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-5 w-20" />
      </div>
    ))}
  </div>
)

export const TransactionTable = ({
  transactions,
  showUserColumn = false,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  emptyMessage = "Aucune transaction trouvée",
  onEditTransaction,
  onDeleteTransaction,
}: TransactionTableProps) => {
  const showActionsColumn = showUserColumn && (onEditTransaction || onDeleteTransaction)
  if (isLoading && transactions.length === 0) {
    return <TableSkeleton rows={5} showUserColumn={showUserColumn} />
  }

  if (transactions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 py-16 dark:border-gray-700 dark:bg-gray-800/30"
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
          <CreditCard className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
          {emptyMessage}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
          Les transactions apparaîtront ici une fois effectuées
        </p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/50">
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Produit</TableHead>
              {showUserColumn && (
                <TableHead className="font-semibold">Utilisateur</TableHead>
              )}
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Statut</TableHead>
              <TableHead className="text-right font-semibold">Montant</TableHead>
              {showActionsColumn && (
                <TableHead className="w-12"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction, index) => (
              <motion.tr
                key={transaction._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="group border-b border-gray-100 transition-colors hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/30"
              >
                <TableCell className="font-medium">
                  <div className="space-y-0.5">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {formatShortDate(transaction.createdAt)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeOnly(transaction.createdAt)}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {transaction.product?.name || "Produit inconnu"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {transaction.durationDays} jours · {transaction.accessType === "exam" ? "Examens" : "Entraînement"}
                    </p>
                  </div>
                </TableCell>
                {showUserColumn && (
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {transaction.user?.name || "Utilisateur"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {transaction.user?.email}
                      </p>
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <TypeBadge type={transaction.type} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={transaction.status} />
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "text-lg font-bold",
                    transaction.status === "completed"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-900 dark:text-white"
                  )}>
                    {formatCurrency(transaction.amountPaid, transaction.currency)}
                  </span>
                </TableCell>
                {showActionsColumn && (
                  <TableCell>
                    {transaction.type === "manual" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEditTransaction && (
                            <DropdownMenuItem
                              onClick={() => onEditTransaction(transaction)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          {onDeleteTransaction && (
                            <DropdownMenuItem
                              onClick={() => onDeleteTransaction(transaction)}
                              className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Load more button */}
      {hasMore && onLoadMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-4"
        >
          <Button
            variant="outline"
            onClick={() => onLoadMore?.()}
            disabled={isLoading}
            className="rounded-xl"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                Chargement...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Charger plus
                <ChevronDown className="h-4 w-4" />
              </span>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  )
}
