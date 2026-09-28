"use client"

import {
  Banknote,
  ChevronDown,
  CircleCheckBig,
  CircleX,
  Clock,
  CreditCard,
  EllipsisVertical,
  type LucideIcon,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { motion } from "motion/react"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { StatusPill, type StatusTone } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import type { AdminTransactionView } from "@/features/payments/dal"
import { formatCurrency, formatShortDate, formatTimeOnly } from "@/lib/format"
import { cn } from "@/lib/utils"
import { disputeBadge } from "./dispute-badge"

type TransactionStatus = "pending" | "completed" | "failed" | "refunded"
type TransactionType = "stripe" | "manual"

// `_id` est un champ-pont qui porte l'id Drizzle (cuid). Conservé tant que des
// écrans non convertis (admin users/[id]) partagent ce composant.
interface Transaction {
  _id: string
  type: TransactionType
  status: TransactionStatus
  amountPaid: number
  currency: string
  accessType: "exam" | "training"
  durationDays: number
  createdAt: number
  completedAt?: number | null
  paymentMethod?: string | null
  notes?: string | null
  disputeStatus?: string | null
  product?: { _id: string; name: string } | null
  user?: { _id: string; name: string; email: string } | null
}

interface TransactionTableProps {
  transactions: Transaction[]
  showUserColumn?: boolean
  /** Rechargement en place (filtre, « Charger plus ») : les lignes restent. */
  isPending?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  emptyMessage?: string
  onEditTransaction?: (transaction: Transaction) => void
  onDeleteTransaction?: (transaction: Transaction) => void
}

export type { Transaction }

// Adapte le modèle DAL admin (id Drizzle) au contrat `_id` de la table. Partagé
// par la page transactions et la page détail utilisateur.
export const adminTransactionToRow = (
  tx: AdminTransactionView,
): Transaction => ({
  _id: tx.id,
  type: tx.type,
  status: tx.status,
  amountPaid: tx.amountPaid,
  currency: tx.currency,
  accessType: tx.accessType,
  durationDays: tx.durationDays,
  createdAt: tx.createdAt,
  completedAt: tx.completedAt,
  paymentMethod: tx.paymentMethod,
  notes: tx.notes,
  disputeStatus: tx.disputeStatus,
  product: tx.product ? { _id: tx.product.id, name: tx.product.name } : null,
  user: tx.user
    ? { _id: tx.user.id, name: tx.user.name, email: tx.user.email }
    : null,
})

const statusConfig: Record<
  TransactionStatus,
  { label: string; icon: LucideIcon; tone: StatusTone }
> = {
  completed: { label: "Complété", icon: CircleCheckBig, tone: "success" },
  pending: { label: "En attente", icon: Clock, tone: "warning" },
  failed: { label: "Échoué", icon: CircleX, tone: "danger" },
  refunded: { label: "Remboursé", icon: RotateCcw, tone: "accent" },
}

const typeConfig: Record<
  TransactionType,
  { label: string; icon: LucideIcon; tone: StatusTone }
> = {
  stripe: { label: "Stripe", icon: CreditCard, tone: "info" },
  manual: { label: "Manuel", icon: Banknote, tone: "neutral" },
}

const disputeTone = {
  danger: "danger",
  success: "success",
  muted: "neutral",
} as const satisfies Record<string, StatusTone>

const DisputeBadge = ({ status }: { status: string | null | undefined }) => {
  const badge = disputeBadge(status)
  if (!badge) return null
  return <StatusPill tone={disputeTone[badge.tone]}>{badge.label}</StatusPill>
}

const StatusBadge = ({ status }: { status: TransactionStatus }) => {
  const { label, icon, tone } = statusConfig[status]
  return (
    <StatusPill tone={tone} icon={icon}>
      {label}
    </StatusPill>
  )
}

const TypeBadge = ({ type }: { type: TransactionType }) => {
  const { label, icon, tone } = typeConfig[type]
  return (
    <StatusPill tone={tone} icon={icon}>
      {label}
    </StatusPill>
  )
}

const EmptyTransactions = ({ message }: { message: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 py-16 dark:border-gray-700 dark:bg-gray-800/30"
  >
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
      <CreditCard className="h-8 w-8 text-gray-400" />
    </div>
    <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
      {message}
    </p>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
      Les transactions apparaîtront ici une fois effectuées
    </p>
  </motion.div>
)

const ManualTransactionMenu = ({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
        <EllipsisVertical className="h-4 w-4" />
        <span className="sr-only">Actions</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {onEdit && (
        <DropdownMenuItem onClick={() => onEdit(transaction)}>
          <Pencil className="mr-2 h-4 w-4" />
          Modifier
        </DropdownMenuItem>
      )}
      {onDelete && (
        <DropdownMenuItem
          onClick={() => onDelete(transaction)}
          className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)

function transactionColumns(
  showUserColumn: boolean,
): DataTableColumn<Transaction>[] {
  return [
    {
      id: "date",
      label: "Date",
      cellClassName: "font-medium",
      cell: (transaction) => (
        <div className="space-y-0.5">
          <p className="text-sm text-gray-900 dark:text-white">
            {formatShortDate(transaction.createdAt)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimeOnly(transaction.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: "product",
      label: "Produit",
      cell: (transaction) => (
        <div className="space-y-0.5">
          <p className="font-medium text-gray-900 dark:text-white">
            {transaction.product?.name || "Produit inconnu"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {transaction.durationDays} jours ·{" "}
            {transaction.accessType === "exam" ? "Examens" : "Entraînement"}
          </p>
        </div>
      ),
    },
    ...(showUserColumn
      ? [
          {
            id: "user",
            label: "Utilisateur",
            visibleFrom: "medium",
            cell: (transaction) => (
              <div className="space-y-0.5">
                <p className="font-medium text-gray-900 dark:text-white">
                  {transaction.user?.name || "Utilisateur"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {transaction.user?.email}
                </p>
              </div>
            ),
          } satisfies DataTableColumn<Transaction>,
        ]
      : []),
    {
      id: "type",
      label: "Type",
      visibleFrom: "medium",
      cell: (transaction) => <TypeBadge type={transaction.type} />,
    },
    {
      id: "status",
      label: "Statut",
      cell: (transaction) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={transaction.status} />
          <DisputeBadge status={transaction.disputeStatus} />
        </div>
      ),
    },
    {
      id: "amount",
      label: "Montant",
      className: "text-right",
      cell: (transaction) => (
        <span
          className={cn(
            "text-lg font-bold",
            transaction.status === "completed"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-gray-900 dark:text-white",
          )}
        >
          {formatCurrency(transaction.amountPaid, transaction.currency)}
        </span>
      ),
    },
  ]
}

export const TransactionTable = ({
  transactions,
  showUserColumn = false,
  isPending = false,
  onLoadMore,
  hasMore = false,
  emptyMessage = "Aucune transaction trouvée",
  onEditTransaction,
  onDeleteTransaction,
}: TransactionTableProps) => {
  const hasActions = Boolean(onEditTransaction || onDeleteTransaction)

  return (
    <div className="space-y-4">
      <DataTable
        columns={transactionColumns(showUserColumn)}
        rows={transactions}
        getRowId={(transaction) => transaction._id}
        isPending={isPending}
        empty={<EmptyTransactions message={emptyMessage} />}
        action={
          hasActions
            ? {
                label: "Actions",
                cell: (transaction) =>
                  transaction.type === "manual" && (
                    <ManualTransactionMenu
                      transaction={transaction}
                      onEdit={onEditTransaction}
                      onDelete={onDeleteTransaction}
                    />
                  ),
              }
            : undefined
        }
      />

      {hasMore && onLoadMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-4"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onLoadMore()}
            disabled={isPending}
            className="rounded-xl"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
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
