"use client"

import { Banknote, CreditCard, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { StatusPill, type StatusTone } from "@/components/shared/status-pill"
import { EmptyState } from "@/components/ui/empty-state"
import type { MyTransactionView } from "@/features/payments/dal"
import { formatCurrency, formatShortDate, formatTimeOnly } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ACCESS_TYPE_LABEL } from "./access-badge"
import { TransactionStatusPill } from "./transaction-status"

type TransactionType = MyTransactionView["type"]

const TYPE: Record<
  TransactionType,
  { label: string; icon: LucideIcon; tone: StatusTone }
> = {
  stripe: { label: "Stripe", icon: CreditCard, tone: "info" },
  manual: { label: "Manuel", icon: Banknote, tone: "neutral" },
}

const columns: DataTableColumn<MyTransactionView>[] = [
  {
    id: "date",
    label: "Date",
    cell: (t) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-ink text-sm">{formatShortDate(t.createdAt)}</span>
        <span className="text-ink-3 font-mono text-xs">
          {formatTimeOnly(t.createdAt)}
        </span>
      </div>
    ),
  },
  {
    id: "product",
    label: "Produit",
    cell: (t) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-ink font-medium">
          {t.product?.name ?? "Produit inconnu"}
        </span>
        <span className="text-ink-3 text-xs">
          {t.durationDays} jours · {ACCESS_TYPE_LABEL[t.accessType]}
        </span>
      </div>
    ),
  },
  {
    id: "type",
    label: "Type",
    visibleFrom: "medium",
    cell: (t) => {
      const { label, icon, tone } = TYPE[t.type]
      return (
        <StatusPill tone={tone} icon={icon}>
          {label}
        </StatusPill>
      )
    },
  },
  {
    id: "status",
    label: "Statut",
    cell: (t) => <TransactionStatusPill status={t.status} />,
  },
  {
    id: "amount",
    label: "Montant",
    className: "text-right",
    cell: (t) => (
      <span
        className={cn(
          "font-mono tabular-nums",
          t.status === "completed" ? "text-ink" : "text-ink-3",
          t.status === "refunded" && "line-through",
        )}
      >
        {formatCurrency(t.amountPaid, t.currency)}
      </span>
    ),
  },
]

/** Historique des paiements de l'étudiant (page Abonnements). */
export const TransactionTable = ({
  transactions,
  isPending = false,
  emptyMessage = "Aucune transaction trouvée",
  footer,
}: {
  transactions: MyTransactionView[]
  /** Rechargement en place (page suivante) : les lignes restent. */
  isPending?: boolean
  emptyMessage?: string
  /** Pied de liste (pagination), rendu sous le tableau. */
  footer?: ReactNode
}) => (
  <div className="flex flex-col">
    <DataTable
      columns={columns}
      rows={transactions}
      getRowId={(t) => t.id}
      isPending={isPending}
      empty={
        <EmptyState
          size="compact"
          icons={[CreditCard]}
          title={emptyMessage}
          description="Les transactions apparaîtront ici une fois effectuées."
          className="py-12"
        />
      }
    />
    {transactions.length > 0 && footer}
  </div>
)
