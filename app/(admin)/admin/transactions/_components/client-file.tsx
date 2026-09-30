"use client"

import {
  ArrowLeft,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock,
  type LucideIcon,
  Plus,
  ShieldAlert,
  Undo2,
  UserRound,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { ACCESS_TYPE_LABEL } from "@/components/shared/payments/access-badge"
import {
  accessLine,
  transactionTypeLabel,
  verdictLine,
} from "@/components/shared/payments/transaction-labels"
import { TransactionStatusWithDispute } from "@/components/shared/payments/transaction-status"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { loadClientTimeline } from "@/features/payments/actions"
import type {
  AdminTransactionView,
  TransactionClientFile,
} from "@/features/payments/dal"
import { TIMELINE_MORE } from "@/features/payments/page-sizes"
import { formatClockTime, formatCurrency, formatMediumDate } from "@/lib/format"
import { TONE_TEXT } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { TransactionDetail } from "./transaction-detail"

const VERDICT_ICON: Record<ReturnType<typeof verdictLine>["tone"], LucideIcon> =
  {
    danger: CircleX,
    neutral: Undo2,
    success: CircleCheck,
    warning: Clock,
  }

const DOT: Record<AdminTransactionView["status"], string> = {
  completed: "bg-success",
  failed: "bg-danger",
  refunded: "bg-ink-4",
  pending: "bg-warning",
}

const TOUCH = "max-lg:min-h-11 pointer-coarse:min-h-11"

const Timeline = ({
  file,
  expandedId,
  onToggle,
  onEdit,
  onDelete,
}: {
  file: TransactionClientFile
  expandedId: string | null
  onToggle: (id: string) => void
  onEdit: (t: AdminTransactionView) => void
  onDelete: (t: AdminTransactionView) => void
}) => {
  const [older, setOlder] = useState<{
    base: TransactionClientFile["timeline"]
    items: AdminTransactionView[]
    cursor: string | null
  }>({ base: file.timeline, items: [], cursor: file.timeline.nextCursor })
  // Après une écriture, le serveur renvoie une nouvelle première page : les
  // transactions plus anciennes repartent de son curseur, pas de l'ancien.
  if (older.base !== file.timeline)
    setOlder({
      base: file.timeline,
      items: [],
      cursor: file.timeline.nextCursor,
    })
  const [loading, startLoading] = useTransition()
  const items = [...file.timeline.items, ...older.items]
  const remaining = file.transactionCount - items.length
  const nextBatch = Math.min(TIMELINE_MORE, remaining)
  const expandedRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    expandedRef.current?.scrollIntoView({ block: "nearest" })
    // Au montage seulement : amener une transaction ouverte par lien.
  }, [])

  const loadOlder = () => {
    const cursor = older.cursor
    if (!cursor) return
    startLoading(async () => {
      try {
        const page = await loadClientTimeline(file.client.id, cursor)
        setOlder((o) => ({
          ...o,
          items: [...o.items, ...page.items],
          cursor: page.nextCursor,
        }))
      } catch {
        toast.error("Chargement impossible. Vérifiez votre réseau.")
      }
    })
  }

  return (
    <>
      <ol className="border-line-strong ml-1.5 flex flex-col border-l">
        {items.map((t) => {
          const open = expandedId === t.id
          return (
            <li
              key={t.id}
              ref={open ? expandedRef : undefined}
              data-testid={`timeline-${t.id}`}
              className="relative pl-4"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "ring-surface absolute top-4.5 -left-1.25 size-2.25 rounded-xs ring-3",
                  DOT[t.status],
                )}
              />
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggle(t.id)}
                className={cn(
                  "focus-ring hover:bg-surface-2 grid w-full cursor-pointer grid-cols-[92px_minmax(0,1fr)_auto] items-start gap-3 rounded-md px-2.5 py-3 text-left text-sm max-md:grid-cols-[minmax(0,1fr)_auto]",
                  open && "bg-surface-2",
                  TOUCH,
                )}
              >
                <span className="text-ink-3 font-mono text-xs leading-normal max-md:col-span-2">
                  {formatMediumDate(t.createdAt)}
                  <br className="max-md:hidden" />
                  <span className="md:hidden"> · </span>
                  {formatClockTime(t.createdAt)}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-ink font-medium">
                    {t.product?.name ?? "Produit inconnu"}
                  </span>
                  <span className="text-ink-3 text-xs">
                    {transactionTypeLabel(t)}
                  </span>
                  <TransactionStatusWithDispute transaction={t} />
                </span>
                <span
                  className={cn(
                    "font-mono whitespace-nowrap",
                    t.status === "completed" ? "text-ink" : "text-ink-3",
                    t.status === "refunded" && "line-through",
                  )}
                >
                  {formatCurrency(t.amountPaid, t.currency)}
                </span>
              </button>
              {open && (
                <TransactionDetail
                  transaction={t}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              )}
            </li>
          )
        })}
      </ol>
      {remaining > 0 && older.cursor && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:pl-6">
          <Button
            type="button"
            variant="outline"
            onClick={loadOlder}
            disabled={loading}
            className="max-lg:h-11 max-md:w-full pointer-coarse:h-11"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
            Afficher {nextBatch} transaction{nextBatch > 1 ? "s" : ""} plus
            ancienne{nextBatch > 1 ? "s" : ""}
          </Button>
          <span className="text-ink-3 font-mono text-xs">
            {items.length} sur {file.transactionCount}
          </span>
        </div>
      )}
    </>
  )
}

/** Dossier d'un client : accès actuels, constat, chronologie de ses transactions. */
export const ClientFile = ({
  file,
  initialNow,
  initialExpandedId,
  onBack,
  onNewPayment,
  onEdit,
  onDelete,
}: {
  file: TransactionClientFile
  initialNow: number
  initialExpandedId: string | null
  onBack: () => void
  onNewPayment: () => void
  onEdit: (t: AdminTransactionView) => void
  onDelete: (t: AdminTransactionView) => void
}) => {
  const [expandedId, setExpandedId] = useState(initialExpandedId)
  const verdict = verdictLine(file.verdict)
  const VerdictIcon =
    file.verdict.kind === "dispute" ? ShieldAlert : VERDICT_ICON[verdict.tone]
  const label = file.client.name.trim() || file.client.email

  // La transaction dépliée suit l'URL sans nouvelle requête serveur : l'API
  // History native est synchronisée par le routeur.
  const toggle = (id: string) => {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    const params = new URLSearchParams(window.location.search)
    if (next) params.set("tx", next)
    else params.delete("tx")
    window.history.replaceState(null, "", `?${params}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="focus-ring text-accent-ink inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 text-sm lg:hidden"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Tous les clients
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <UserAvatar
          name={label}
          image={file.client.image}
          className="size-10"
        />
        <div className="flex min-w-0 flex-[1_1_200px] flex-col">
          <h2 className="type-h4 text-ink wrap-anywhere">{label}</h2>
          <span className="text-ink-3 text-[0.8125rem] wrap-anywhere">
            {file.client.email}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 max-md:w-full max-md:*:flex-1">
          <Button asChild variant="ghost">
            <Link href={`/admin/utilisateurs/${file.client.id}`}>
              <UserRound aria-hidden="true" />
              Voir la fiche du compte
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onNewPayment}>
            <Plus aria-hidden="true" />
            Paiement pour ce client
          </Button>
        </div>
      </div>

      <div
        data-testid="client-verdict"
        className={cn(
          "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm leading-normal",
          verdict.tone === "danger"
            ? "border-danger bg-surface-2 text-ink"
            : "border-line bg-surface-2 text-ink",
        )}
      >
        <VerdictIcon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-4 shrink-0",
            verdict.tone === "neutral" ? "text-ink-3" : TONE_TEXT[verdict.tone],
          )}
        />
        <span>{verdict.text}</span>
      </div>

      <div className="border-line grid grid-cols-2 rounded-md border max-md:grid-cols-1">
        {(["exam", "training"] as const).map((type, i) => {
          const line = accessLine(file.access[type], initialNow)
          return (
            <div
              key={type}
              className={cn(
                "flex flex-col gap-1 px-3.5 py-3",
                i > 0 && "border-line max-md:border-t md:border-l",
              )}
            >
              <span className="type-label">
                Accès {ACCESS_TYPE_LABEL[type]}
              </span>
              <span
                className={cn(
                  "text-sm",
                  line.state === "active"
                    ? "text-success-ink font-medium"
                    : "text-ink-3",
                )}
              >
                {line.text}
              </span>
              {line.state === "active" && (
                <span className="text-ink-3 text-xs leading-normal">
                  Pour retirer cet accès, remboursez ou supprimez le paiement
                  qui l&apos;a donné.
                </span>
              )}
            </div>
          )
        })}
      </div>

      <Timeline
        file={file}
        expandedId={expandedId}
        onToggle={toggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}
