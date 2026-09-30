import { ExternalLink, Pencil, ShieldAlert, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import {
  grantedAccessLabel,
  transactionTypeLabel,
} from "@/components/shared/payments/transaction-labels"
import { Button } from "@/components/ui/button"
import type { AdminTransactionView } from "@/features/payments/dal"
import { isOpenDispute } from "@/features/payments/dispute"
import {
  formatCurrency,
  formatMediumDate,
  formatMediumDateTime,
  formatPresentmentAmount,
} from "@/lib/format"
import { TONE_SOFT } from "@/lib/tone"
import { cn } from "@/lib/utils"

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-ink-3">{children}</span>
)

const detailRows = (t: AdminTransactionView): [string, ReactNode][] => {
  const rows: (false | [string, ReactNode])[] = [
    [
      "Montant",
      <span key="v" className="font-mono">
        {formatCurrency(t.amountPaid, t.currency)}
      </span>,
    ],
    t.presentmentAmount !== null &&
      t.presentmentCurrency !== null && [
        "Montant présenté",
        <span key="v" className="flex flex-col gap-0.5">
          <span className="font-mono">
            {formatPresentmentAmount(
              t.presentmentAmount,
              t.presentmentCurrency,
            )}
          </span>
          <span className="text-ink-3 text-xs">
            Converti par Stripe pour le client. À titre indicatif, jamais
            comptabilisé.
          </span>
        </span>,
      ],
    ["Produit", t.product?.name ?? <Muted>Produit inconnu</Muted>],
    ["Accès octroyé", grantedAccessLabel(t)],
    (t.status === "completed" || t.status === "refunded") && [
      "Expiration de l'accès",
      <span key="v" className="font-mono">
        {formatMediumDate(t.accessExpiresAt)}
      </span>,
    ],
    [
      "Créée le",
      <span key="v" className="font-mono">
        {formatMediumDateTime(t.createdAt)}
      </span>,
    ],
    [
      "Complétée le",
      t.completedAt ? (
        <span key="v" className="font-mono">
          {formatMediumDateTime(t.completedAt)}
        </span>
      ) : (
        <Muted>Paiement non abouti</Muted>
      ),
    ],
    t.refundedAt !== null && [
      "Remboursée le",
      <span key="v" className="font-mono">
        {formatMediumDateTime(t.refundedAt)}
      </span>,
    ],
    ["Type", transactionTypeLabel(t)],
    t.type === "manual" && [
      "Enregistré par",
      // Nul pour un auteur supprimé comme pour une saisie antérieure au
      // suivi de l'auteur : on ne sait pas lequel.
      t.recordedByName ?? <Muted>—</Muted>,
    ],
    t.type === "stripe" &&
      t.status !== "failed" && [
        "Courriel au client",
        t.confirmationEmailSentAt ? (
          <span key="v">
            Confirmation envoyée le{" "}
            <span className="font-mono">
              {formatMediumDateTime(t.confirmationEmailSentAt)}
            </span>
          </span>
        ) : (
          "Non envoyé"
        ),
      ],
    t.type === "manual" && [
      "Courriel au client",
      <Muted key="v">Aucun courriel envoyé</Muted>,
    ],
    Boolean(t.notes) && ["Note interne", t.notes],
    [
      "Identifiant",
      <span key="v" className="font-mono text-xs">
        {t.id}
      </span>,
    ],
  ]
  return rows.filter((r): r is [string, ReactNode] => r !== false)
}

/** Détail déplié d'une transaction dans la chronologie du dossier. */
export const TransactionDetail = ({
  transaction: t,
  onEdit,
  onDelete,
}: {
  transaction: AdminTransactionView
  onEdit: (t: AdminTransactionView) => void
  onDelete: (t: AdminTransactionView) => void
}) => {
  const disputeOpen = isOpenDispute(t.disputeStatus)
  return (
    <div className="flex flex-col gap-3 px-2.5 pt-1 pb-4">
      {disputeOpen && (
        <div
          role="note"
          className={cn(
            "flex gap-2.5 rounded-md border p-3 text-sm",
            TONE_SOFT.danger,
          )}
        >
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Litige en cours. </span>
            L&apos;accès du client reste actif tant que le litige est en cours.
            Décidez dans Stripe s&apos;il faut le contester.
          </span>
        </div>
      )}
      <dl className="flex flex-col">
        {detailRows(t).map(([k, v]) => (
          <div
            key={k}
            className="border-line grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-t py-2.5 text-sm first:border-t-0 max-md:grid-cols-1 max-md:gap-0.5"
          >
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink wrap-anywhere">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        {t.type === "stripe" ? (
          t.stripeUrl && (
            <Button
              asChild
              size="sm"
              variant={disputeOpen ? "default" : "outline"}
              className="max-lg:h-11 pointer-coarse:h-11"
            >
              <a href={t.stripeUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                {disputeOpen
                  ? "Traiter le litige dans Stripe"
                  : "Ouvrir dans Stripe"}
              </a>
            </Button>
          )
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onEdit(t)}
              className="max-lg:h-11 pointer-coarse:h-11"
            >
              <Pencil aria-hidden="true" />
              Modifier
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDelete(t)}
              className="text-danger-ink hover:text-danger-ink max-lg:h-11 pointer-coarse:h-11"
            >
              <Trash2 aria-hidden="true" />
              Supprimer
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
