"use client"

import { Plus, Receipt, UserSearch } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { PageIntro } from "@/components/shared/page-intro"
import {
  ManualPaymentFlow,
  type PaymentClient,
} from "@/components/shared/payments/manual-payment-dialog"
import {
  DeleteManualPaymentDialog,
  EditManualPaymentDialog,
} from "@/components/shared/payments/manual-payment-edit"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PendingRegion } from "@/components/ui/pending-region"
import type {
  AdminTransactionView,
  ClientFilter,
  ProductView,
  TransactionClientFile,
  TransactionClientsPage,
  TransactionStatsView,
} from "@/features/payments/dal"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { NBSP, formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ClientFile } from "./client-file"
import { ClientList } from "./client-list"
import { listParams } from "./transaction-params"

const SummaryLine = ({ stats }: { stats: TransactionStatsView }) => {
  const { CAD, XAF } = stats.revenueByCurrency
  const cad = (cents: number) => formatCurrency(cents, "CAD", { whole: true })
  return (
    <p
      data-testid="transactions-summary"
      className="text-ink-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs *:whitespace-nowrap"
    >
      <span>
        30 jours{NBSP}:{" "}
        <b className="text-ink font-medium">{cad(CAD.recent)}</b>
      </span>
      <span>
        Depuis le début{NBSP}:{" "}
        <b className="text-ink font-medium">{cad(CAD.total)}</b>
      </span>
      {XAF.total > 0 && (
        <span>
          XAF{NBSP}:{" "}
          <b className="text-ink font-medium">
            {formatCurrency(XAF.total, "XAF")}
          </b>
        </span>
      )}
      <span>
        {stats.buyerCount} acheteur{stats.buyerCount > 1 ? "s" : ""} ·{" "}
        {stats.transactionCount} transaction
        {stats.transactionCount > 1 ? "s" : ""}
      </span>
    </p>
  )
}

/**
 * Transactions, variante « Dossier client » : que s'est-il passé pour ce
 * client ? L'URL porte recherche, filtre, tranche, client et transaction ;
 * chaque changement recharge en place (contenu conservé, grisé).
 */
export const TransactionsClient = ({
  stats,
  clients,
  q,
  filter,
  clientId,
  file,
  txId,
  products,
  initialNow,
}: {
  stats: TransactionStatsView
  clients: TransactionClientsPage
  q: string
  filter: ClientFilter
  clientId: string | null
  file: TransactionClientFile | null
  txId: string | null
  products: ProductView[]
  initialNow: number
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(q)
  const [manual, setManual] = useState<{ client?: PaymentClient } | null>(null)
  const [editing, setEditing] = useState<{
    transaction: AdminTransactionView
  } | null>(null)
  const [deleting, setDeleting] = useState<AdminTransactionView | null>(null)
  // Compté après chaque écriture : la chronologie repart des données fraîches.
  const [writes, setWrites] = useState(0)

  const navigate = (params: URLSearchParams, mode: "push" | "replace") =>
    startTransition(() => {
      const href = params.size ? `${pathname}?${params}` : pathname
      if (mode === "push") router.push(href, { scroll: false })
      else router.replace(href, { scroll: false })
    })

  // Lu dans l'URL courante : la ligne dépliée y est posée sans navigation.
  const current = () => new URLSearchParams(window.location.search)

  useDebouncedValue(search, 300, (value) => {
    if (value.trim() !== q)
      navigate(listParams(current(), { q: value }), "replace")
  })

  const setFilter = (next: ClientFilter) =>
    navigate(listParams(current(), { filter: next }), "replace")

  const clearFilters = () => {
    setSearch("")
    navigate(listParams(current(), { q: "", filter: "all" }), "replace")
  }

  const goToSlice = (param: "apres" | "avant", cursor: string) => {
    const next = current()
    next.delete("apres")
    next.delete("avant")
    next.set(param, cursor)
    navigate(next, "replace")
  }

  const openClient = (id: string | null) => {
    const next = current()
    next.delete("tx")
    if (id) next.set("client", id)
    else next.delete("client")
    navigate(next, "push")
  }

  const afterWrite = (message: string) => {
    toast.success(message)
    setWrites((n) => n + 1)
    startTransition(() => router.refresh())
  }

  const intro = (
    <PageIntro
      eyebrow="Pilotage"
      title="Transactions"
      description="Retrouvez un client, voyez ses accès et tout ce qui s'est passé à chaque tentative de paiement."
      actions={
        <Button type="button" onClick={() => setManual({})}>
          <Plus aria-hidden="true" />
          Paiement manuel
        </Button>
      }
    />
  )

  const dialogs = (
    <>
      <ManualPaymentFlow
        open={manual !== null}
        onOpenChange={(open) => !open && setManual(null)}
        products={products}
        client={manual?.client}
      />
      <EditManualPaymentDialog
        transaction={editing?.transaction ?? null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(refunded) => {
          setEditing(null)
          afterWrite(
            refunded
              ? "Paiement remboursé · accès recalculé"
              : "Paiement modifié",
          )
        }}
      />
      <DeleteManualPaymentDialog
        transaction={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          afterWrite("Paiement supprimé · accès recalculé")
        }}
      />
    </>
  )

  if (stats.transactionCount === 0)
    return (
      <>
        {intro}
        <div className="bg-surface border-line rounded-lg border">
          <EmptyState
            icons={[Receipt]}
            title="Aucune transaction pour l'instant"
            description="Les paiements Stripe apparaîtront ici dès le premier achat. Vous pouvez aussi enregistrer un paiement manuel."
            action={{
              label: "Enregistrer un paiement manuel",
              onClick: () => setManual({}),
            }}
          />
        </div>
        {dialogs}
      </>
    )

  const selected = clientId !== null

  return (
    <>
      {intro}
      <SummaryLine stats={stats} />
      {/* Rechargement en place : contenu conservé et grisé ; le mot suffit,
          sans spinner (loading-ui.md). */}
      <p
        role="status"
        className={cn(
          "text-ink-3 -my-2 h-4 text-center text-[0.8125rem]",
          !isPending && "invisible",
        )}
      >
        {isPending ? "Mise à jour…" : ""}
      </p>
      <PendingRegion
        isPending={isPending}
        className="grid items-start gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
      >
        <div className={cn(selected && "max-lg:hidden")}>
          <ClientList
            clients={clients}
            search={search}
            onSearchChange={setSearch}
            isSearching={isPending && search.trim() !== q}
            filter={filter}
            onFilterChange={setFilter}
            selectedId={clientId}
            onSelect={openClient}
            onPrevious={
              clients.prevCursor
                ? () => goToSlice("avant", clients.prevCursor!)
                : undefined
            }
            onNext={
              clients.nextCursor
                ? () => goToSlice("apres", clients.nextCursor!)
                : undefined
            }
            onClear={clearFilters}
            isPending={isPending}
          />
        </div>
        <section
          aria-label="Dossier du client"
          className={cn(
            "bg-surface border-line min-w-0 rounded-lg border px-6 py-5 max-md:p-4",
            !selected && "max-lg:hidden",
          )}
        >
          {file ? (
            <ClientFile
              // Une navigation vers une autre transaction du même client
              // (« Voir la transaction ») remonte le dossier sur elle.
              key={`${file.client.id}:${txId ?? ""}`}
              writes={writes}
              file={file}
              initialNow={initialNow}
              initialExpandedId={txId}
              onBack={() => openClient(null)}
              onNewPayment={() =>
                setManual({
                  client: {
                    id: file.client.id,
                    label: file.client.name.trim() || file.client.email,
                  },
                })
              }
              onEdit={(transaction) => setEditing({ transaction })}
              onDelete={setDeleting}
            />
          ) : (
            <EmptyState
              size="compact"
              icons={[UserSearch]}
              title={
                selected
                  ? "Aucune transaction pour ce compte"
                  : "Choisissez un client"
              }
              description={
                selected
                  ? "Ce compte n'a jamais tenté de payer."
                  : "Son dossier réunit ses accès, un constat et toutes ses tentatives de paiement, échecs compris."
              }
              className="py-14"
            />
          )}
        </section>
      </PendingRegion>
      {dialogs}
    </>
  )
}
