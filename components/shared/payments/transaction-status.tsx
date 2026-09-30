import {
  CircleCheckBig,
  CircleX,
  Clock,
  type LucideIcon,
  RotateCcw,
} from "lucide-react"
import { StatusPill, type StatusTone } from "@/components/shared/status-pill"
import type { TransactionStatus } from "@/schemas/payment"
import { disputeBadge } from "./dispute-badge"

const TRANSACTION_STATUS: Record<
  TransactionStatus,
  { label: string; icon: LucideIcon; tone: StatusTone }
> = {
  completed: { label: "Complété", icon: CircleCheckBig, tone: "success" },
  pending: { label: "En attente", icon: Clock, tone: "warning" },
  failed: { label: "Échoué", icon: CircleX, tone: "danger" },
  refunded: { label: "Remboursé", icon: RotateCcw, tone: "neutral" },
}

/** Tonalité d'un statut de transaction (pastille, repère de chronologie). */
export const transactionStatusTone = (status: TransactionStatus): StatusTone =>
  TRANSACTION_STATUS[status].tone

/** Pastille du statut d'une transaction. */
export const TransactionStatusPill = ({
  status,
}: {
  status: TransactionStatus
}) => {
  const { label, icon, tone } = TRANSACTION_STATUS[status]
  return (
    <StatusPill tone={tone} icon={icon}>
      {label}
    </StatusPill>
  )
}

/** Statut d'une transaction et, s'il y en a un, son litige. */
export const TransactionStatusWithDispute = ({
  transaction,
}: {
  transaction: { status: TransactionStatus; disputeStatus: string | null }
}) => {
  const badge = disputeBadge(transaction.disputeStatus)
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <TransactionStatusPill status={transaction.status} />
      {badge && (
        <StatusPill tone={badge.tone === "muted" ? "neutral" : badge.tone}>
          {badge.label}
        </StatusPill>
      )}
    </span>
  )
}
