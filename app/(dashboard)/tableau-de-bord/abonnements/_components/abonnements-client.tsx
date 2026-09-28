"use client"

import {
  ArrowRight,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  Receipt,
} from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"
import { AccessCard } from "@/components/shared/payments/access-card"
import {
  type Transaction,
  TransactionTable,
} from "@/components/shared/payments/transaction-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  createCustomerPortal,
  loadMoreMyTransactions,
} from "@/features/payments/actions"
import type {
  AccessStatus,
  MyTransactionView,
  MyTransactionsPage,
  ProductView,
} from "@/features/payments/dal"
import { callAction } from "@/lib/safe-action"
import { cn } from "@/lib/utils"

// Adapte le modèle DAL au contrat (numérique) attendu par TransactionTable.
const toTableTransaction = (tx: MyTransactionView): Transaction => ({
  _id: tx.id,
  type: tx.type,
  status: tx.status,
  amountPaid: tx.amountPaid,
  currency: tx.currency,
  accessType: tx.accessType,
  durationDays: tx.durationDays,
  createdAt: tx.createdAt,
  completedAt: tx.completedAt ?? undefined,
  paymentMethod: tx.paymentMethod ?? undefined,
  notes: tx.notes ?? undefined,
  product: tx.product ? { _id: tx.product.id, name: tx.product.name } : null,
})

const AccessAction = ({
  type,
  active,
}: {
  type: "exam" | "training"
  active: boolean
}) =>
  active ? (
    <Button asChild variant="outline" className="w-full rounded-xl">
      <Link href="/tarifs">
        <Clock className="mr-2 h-4 w-4" />
        Prolonger l{"'"}accès
      </Link>
    </Button>
  ) : (
    <Button
      asChild
      className={cn(
        "w-full rounded-xl bg-linear-to-r text-white hover:opacity-90",
        type === "exam"
          ? "from-blue-600 to-indigo-600"
          : "from-emerald-600 to-teal-600",
      )}
    >
      <Link href="/tarifs">
        Activer l{"'"}accès
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  )

export const AbonnementsClient = ({
  accessStatus,
  initialTransactions,
  products,
}: {
  accessStatus: AccessStatus
  initialTransactions: MyTransactionsPage
  products: ProductView[]
}) => {
  const [items, setItems] = useState<MyTransactionView[]>(
    initialTransactions.items,
  )
  const [cursor, setCursor] = useState<string | null>(
    initialTransactions.nextCursor,
  )
  const [isLoadingMore, startLoadMore] = useTransition()

  const handleLoadMore = () => {
    if (!cursor) return
    startLoadMore(async () => {
      try {
        const next = await loadMoreMyTransactions(cursor)
        setItems((prev) => [...prev, ...next.items])
        setCursor(next.nextCursor)
      } catch {
        toast.error("Impossible de charger plus de transactions")
      }
    })
  }

  const [, startTransition] = useTransition()

  const [, openPortalAction, isLoadingPortal] = useActionState(
    async () => {
      // callAction : sans lui, un rejet fetch dans une action useActionState
      // remonte à l'error boundary au rendu (React 19) — ActionFailure porte
      // `error`, le garde ci-dessous l'attrape aussi
      const res = await callAction(() =>
        createCustomerPortal("/tableau-de-bord/abonnements"),
      )
      if ("error" in res) {
        if (!navigator.onLine) {
          toast.error("Pas de connexion internet. Vérifiez votre réseau.")
        } else if (res.error.includes("Aucun historique")) {
          toast.error(
            "Aucun achat effectué. Effectuez un premier achat pour accéder à vos factures.",
          )
        } else {
          toast.error(res.error)
        }
        return { success: false }
      }
      window.location.href = res.portalUrl
      return { success: true }
    },
    { success: false },
  )

  const hasProductsToUpsell = products.length > 0
  const showUpgradeBanner =
    hasProductsToUpsell &&
    (!accessStatus.examAccess || !accessStatus.trainingAccess)

  const tableTransactions = items.map(toTableTransaction)

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">Mon Abonnement</h1>
          <p className="text-muted-foreground">
            Gérez vos accès et consultez votre historique de paiements
          </p>
        </div>
        <div className="flex gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isLoadingPortal}
                className="rounded-xl"
              >
                {isLoadingPortal ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    Chargement...
                  </span>
                ) : (
                  <>
                    <Receipt className="mr-2 h-4 w-4" />
                    Gérer mes factures
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Ouvrir le portail de facturation
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Vous allez être redirigé vers le portail Stripe pour gérer vos
                  factures et méthodes de paiement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => startTransition(() => openPortalAction())}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700"
                >
                  Continuer vers Stripe
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Access cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <AccessCard
          type="exam"
          access={accessStatus.examAccess}
          action={(active) => <AccessAction type="exam" active={active} />}
        />
        <AccessCard
          type="training"
          access={accessStatus.trainingAccess}
          action={(active) => <AccessAction type="training" active={active} />}
        />
      </div>

      {/* Upgrade banner */}
      {showUpgradeBanner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-xl"
        >
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  Débloquez l{"'"}accès complet
                </h3>
                <p className="text-sm text-blue-100">
                  Économisez avec nos offres 6 mois
                </p>
              </div>
            </div>
            <Button
              asChild
              size="lg"
              className="rounded-xl bg-white px-6 font-bold text-blue-600 hover:bg-blue-50"
            >
              <Link href="/tarifs">
                Voir les tarifs
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Transaction history */}
      <Card className="rounded-2xl border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Historique des transactions
          </CardTitle>
          <CardDescription>Vos achats et paiements récents</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionTable
            transactions={tableTransactions}
            isPending={isLoadingMore}
            onLoadMore={handleLoadMore}
            hasMore={cursor !== null}
            emptyMessage="Aucune transaction pour le moment"
          />
        </CardContent>
      </Card>
    </div>
  )
}
