"use client"

import { ArrowRight, Clock, ExternalLink, Receipt } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { KeysetPagination } from "@/components/shared/data-table/keyset-pagination"
import { PageIntro } from "@/components/shared/page-intro"
import { ACCESS_TYPE_LABEL } from "@/components/shared/payments/access-badge"
import { AccessCard } from "@/components/shared/payments/access-card"
import { TransactionTable } from "@/components/shared/payments/transaction-table"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { AccessType } from "@/features/payments/access-ledger"
import { createCustomerPortal } from "@/features/payments/actions"
import type {
  AccessStatus,
  LapsedAccess,
  MyTransactionsPage,
  ProductView,
} from "@/features/payments/dal"
import { MY_TRANSACTIONS_PAGE_SIZE } from "@/features/payments/page-sizes"
import { formatCurrency, formatExpiration } from "@/lib/format"
import { cheapestMonthly, monthsOf, savingsOf } from "@/lib/pricing"
import { callAction } from "@/lib/safe-action"

const cad = (cents: number) => formatCurrency(cents, "CAD", { whole: true })

const AccessAction = ({
  type,
  active,
  lapsed,
}: {
  type: AccessType
  active: boolean
  lapsed: boolean
}) =>
  active ? (
    <div className="flex flex-col gap-2">
      <Button asChild variant="outline" className="w-full max-md:h-11">
        <Link href="/tarifs">
          <Clock aria-hidden="true" />
          Prolonger l&apos;accès
        </Link>
      </Button>
      {/* Le Pack Premium ouvre une période neuve (registre d'accès) : seul
          un accès simple prolonge le temps restant. */}
      <p className="text-ink-3 text-xs">
        Le temps restant s&apos;ajoute à un nouvel accès{" "}
        {ACCESS_TYPE_LABEL[type]} ; le Pack Premium ne se cumule pas.
      </p>
    </div>
  ) : (
    <Button asChild className="w-full max-md:h-11">
      <Link href="/tarifs">
        {lapsed ? "Réactiver l'accès" : "Activer l'accès"}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  )

const PremiumBanner = ({ products }: { products: ProductView[] }) => {
  const combo = products.find((p) => p.isCombo)
  if (!combo) return null
  const savings = savingsOf(products, combo)
  const months = monthsOf(combo)
  return (
    <div className="bg-surface-2 border-line flex flex-wrap items-center justify-between gap-4 rounded-lg border px-6 py-5 max-md:px-5">
      <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-1.5">
        <span className="flex flex-wrap gap-2">
          <StatusPill tone="warning" className="font-mono uppercase">
            Premium
          </StatusPill>
          <StatusPill tone="neutral" className="font-mono uppercase">
            Examens + Entraînement
          </StatusPill>
        </span>
        <p className="text-ink text-[1.0625rem] font-semibold">
          Pack Premium : les deux accès pendant {months} mois
        </p>
        {savings && (
          <p className="text-ink-2 text-sm">
            <span className="text-ink font-mono">{cad(combo.priceCAD)}</span> au
            lieu de{" "}
            <span className="line-through">{cad(savings.referenceCAD)}</span> en
            achetant séparément, soit {cad(savings.savedCAD)} d&apos;économie.
          </p>
        )}
      </div>
      <Button asChild className="max-[480px]:w-full max-md:h-11">
        <Link href="/tarifs">
          Voir les tarifs
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  )
}

export const AbonnementsClient = ({
  accessStatus,
  lapsed,
  transactions,
  products,
}: {
  accessStatus: AccessStatus
  lapsed: LapsedAccess
  transactions: MyTransactionsPage
  products: ProductView[]
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isPaging, startPaging] = useTransition()
  const [portalOpen, setPortalOpen] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const goTo = (param: "apres" | "avant", cursor: string) =>
    startPaging(() => {
      router.push(`${pathname}?${new URLSearchParams({ [param]: cursor })}`, {
        scroll: false,
      })
    })

  // Le portail Stripe ne s'ouvre qu'ici, après confirmation dans le Dialog.
  const openPortal = async () => {
    const res = await callAction(() =>
      createCustomerPortal("/tableau-de-bord/abonnements"),
    )
    if ("error" in res) {
      if (res.error.includes("Aucun historique")) {
        toast.error(
          "Aucun achat effectué. Effectuez un premier achat pour accéder à vos factures.",
        )
        return
      }
      toast.error(
        navigator.onLine
          ? res.error
          : "Pas de connexion internet. Vérifiez votre réseau.",
      )
      // Échec passager : le Dialog reste ouvert pour réessayer.
      return false
    }
    setRedirecting(true)
    window.location.href = res.portalUrl
  }

  const inactiveNote = (type: AccessType) => {
    const lapsedAt = lapsed[type]
    if (lapsedAt !== null)
      return (
        <>
          Expiré le{" "}
          <span className="text-ink font-medium">
            {formatExpiration(lapsedAt)}
          </span>
          . Vos résultats restent consultables.
        </>
      )
    const monthly = cheapestMonthly(products, type)
    return monthly
      ? `Aucun accès actif. À partir de ${cad(monthly.priceCAD)} pour 1 mois.`
      : "Aucun accès actif."
  }

  const missingAccess = !accessStatus.examAccess || !accessStatus.trainingAccess

  return (
    <>
      <PageIntro
        eyebrow="Compte"
        title="Abonnements et accès"
        description="Gérez vos accès et consultez votre historique de paiements."
        actions={
          <Button
            variant="outline"
            aria-disabled={redirecting}
            onClick={() => {
              if (!redirecting) setPortalOpen(true)
            }}
            data-testid="billing-portal-open"
            className="max-md:h-11"
          >
            {redirecting ? (
              <>
                <Spinner size="sm" />
                Redirection vers Stripe…
              </>
            ) : (
              <>
                <Receipt aria-hidden="true" />
                Gérer mes factures
                <ExternalLink aria-hidden="true" />
              </>
            )}
          </Button>
        }
      />

      <ConfirmDialog
        open={portalOpen}
        onOpenChange={setPortalOpen}
        title="Ouvrir le portail de facturation"
        description="Vous allez être redirigé vers le portail Stripe pour gérer vos factures et vos moyens de paiement."
        confirmLabel={
          <>
            Continuer vers Stripe
            <ExternalLink aria-hidden="true" />
          </>
        }
        confirmTestId="billing-portal-confirm"
        onConfirm={openPortal}
      />

      <section
        aria-labelledby="acces-title"
        className="grid grid-cols-2 gap-3 max-md:grid-cols-1"
      >
        <h2 id="acces-title" className="sr-only">
          Vos accès
        </h2>
        {(["exam", "training"] as const).map((type) => (
          <AccessCard
            key={type}
            type={type}
            access={
              type === "exam"
                ? accessStatus.examAccess
                : accessStatus.trainingAccess
            }
            inactiveNote={inactiveNote(type)}
            action={(active) => (
              <AccessAction
                type={type}
                active={active}
                lapsed={lapsed[type] !== null}
              />
            )}
          />
        ))}
      </section>

      {missingAccess && <PremiumBanner products={products} />}

      <section className="bg-surface border-line shadow-1 flex min-w-0 flex-col rounded-lg border">
        <div className="flex flex-col gap-1 px-6 pt-5 pb-4 max-md:px-5">
          <p className="type-label">Paiements</p>
          <h2 className="type-h4 text-ink">Historique des transactions</h2>
          <p className="text-ink-3 text-sm">
            Vos achats et paiements, du plus récent au plus ancien.
          </p>
        </div>
        <div className="border-line border-t px-6 py-4 max-md:px-5">
          <TransactionTable
            transactions={transactions.items}
            isPending={isPaging}
            emptyMessage="Aucune transaction pour le moment."
            footer={
              <KeysetPagination
                firstIndex={transactions.firstIndex}
                count={transactions.items.length}
                pageSize={MY_TRANSACTIONS_PAGE_SIZE}
                isPending={isPaging}
                onPrevious={
                  transactions.prevCursor
                    ? () => goTo("avant", transactions.prevCursor!)
                    : undefined
                }
                onNext={
                  transactions.nextCursor
                    ? () => goTo("apres", transactions.nextCursor!)
                    : undefined
                }
              />
            }
          />
        </div>
      </section>
    </>
  )
}
