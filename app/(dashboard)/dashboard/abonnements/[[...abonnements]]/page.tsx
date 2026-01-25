"use client"

import {
  useAction,
  useConvexAuth,
  usePaginatedQuery,
  useQuery,
} from "convex/react"
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  Receipt,
  Sparkles,
  Zap,
} from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useActionState, useTransition } from "react"
import { toast } from "sonner"
import {
  AccessBadge,
  TransactionTable,
  getAccessStatus,
} from "@/components/shared/payments"
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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { formatExpiration } from "@/lib/format"
import { cn } from "@/lib/utils"

const accessTypeConfig = {
  exam: {
    icon: Zap,
    label: "Examens Simulés",
    gradient: "from-blue-600 to-indigo-600",
    lightGradient:
      "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
    accentColor: "text-blue-600 dark:text-blue-400",
    description: "Accès aux examens blancs chronométrés",
  },
  training: {
    icon: Sparkles,
    label: "Banque d'Entraînement",
    gradient: "from-emerald-600 to-teal-600",
    lightGradient:
      "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    description: "Accès à 5000+ questions d'entraînement",
  },
}

const AccessCard = ({
  type,
  access,
}: {
  type: "exam" | "training"
  access: { expiresAt: number; daysRemaining: number } | null
}) => {
  const config = accessTypeConfig[type]
  const Icon = config.icon
  const status = getAccessStatus(access?.expiresAt, access?.daysRemaining)
  const isActive = status === "active" || status === "expiring"
  const progressPercent = access
    ? Math.min((access.daysRemaining / 180) * 100, 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300",
        isActive
          ? "border-transparent bg-white shadow-xl dark:bg-gray-900"
          : "border-dashed border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30",
      )}
    >
      {/* Gradient accent for active */}
      {isActive && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
            config.gradient,
          )}
        />
      )}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              isActive
                ? cn("bg-gradient-to-br shadow-lg", config.gradient)
                : "bg-gray-200 dark:bg-gray-700",
            )}
          >
            <Icon
              className={cn(
                "h-6 w-6",
                isActive ? "text-white" : "text-gray-400 dark:text-gray-500",
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {config.label}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {config.description}
            </p>
          </div>
        </div>
        <AccessBadge
          accessType={type}
          status={status}
          daysRemaining={access?.daysRemaining}
          size="sm"
        />
      </div>

      {/* Active state details */}
      {isActive && access && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Temps restant
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {access.daysRemaining} jours
              </span>
            </div>
            <Progress
              value={progressPercent}
              className="h-2"
              aria-label={`${access.daysRemaining} jours restants sur votre accès`}
            />
          </div>

          {/* Expiration date */}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              Expire le
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatExpiration(access.expiresAt)}
            </span>
          </div>

          {/* Extend button */}
          <Link href="/tarifs">
            <Button variant="outline" className="w-full rounded-xl">
              <Clock className="mr-2 h-4 w-4" />
              Prolonger l{"'"}accès
            </Button>
          </Link>
        </div>
      )}

      {/* Inactive state */}
      {!isActive && (
        <div className="mt-4">
          <Link href="/tarifs">
            <Button
              className={cn(
                "w-full rounded-xl bg-gradient-to-r text-white hover:opacity-90",
                config.gradient,
              )}
            >
              Activer l{"'"}accès
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </motion.div>
  )
}

const AccountPageSkeleton = () => (
  <div className="space-y-8">
    <div className="grid gap-6 md:grid-cols-2">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border p-6">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
    <div className="rounded-2xl border p-6">
      <Skeleton className="mb-6 h-6 w-48" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  </div>
)

export default function AbonnementsPage() {
  const { isAuthenticated } = useConvexAuth()

  const accessStatus = useQuery(
    api.payments.getMyAccessStatus,
    isAuthenticated ? undefined : "skip",
  )
  const {
    results: transactions,
    status: txStatus,
    loadMore,
  } = usePaginatedQuery(
    api.payments.getMyTransactions,
    isAuthenticated ? {} : "skip",
    { initialNumItems: 5 },
  )
  const createPortal = useAction(api.stripe.createCustomerPortalSession)

  // Transition for action state
  const [, startTransition] = useTransition()

  const [, openPortalAction, isLoadingPortal] = useActionState(
    async () => {
      try {
        const { portalUrl } = await createPortal({
          returnUrl: `${window.location.origin}/dashboard/abonnements`,
        })
        window.location.href = portalUrl
        return { success: true }
      } catch (error) {
        console.error("Erreur portail:", error)

        const errorMessage = error instanceof Error ? error.message : ""

        if (!navigator.onLine) {
          toast.error("Pas de connexion internet. Vérifiez votre réseau.")
        } else if (errorMessage.includes("Aucun historique de paiement")) {
          toast.error(
            "Aucun achat effectué. Effectuez un premier achat pour accéder à vos factures.",
          )
        } else {
          toast.error("Impossible d'ouvrir le portail de facturation")
        }
        return { success: false, error: errorMessage }
      }
    },
    { success: false, error: undefined },
  )

  if (accessStatus === undefined) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">Mon Abonnement</h1>
          <p className="text-muted-foreground">
            Gérez vos accès et consultez votre historique
          </p>
        </div>
        <AccountPageSkeleton />
      </div>
    )
  }

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
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
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
        <AccessCard type="exam" access={accessStatus?.examAccess ?? null} />
        <AccessCard
          type="training"
          access={accessStatus?.trainingAccess ?? null}
        />
      </div>

      {/* Upgrade banner */}
      {(!accessStatus?.examAccess || !accessStatus?.trainingAccess) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-xl"
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
            <Link href="/tarifs">
              <Button
                size="lg"
                className="rounded-xl bg-white px-6 font-bold text-blue-600 hover:bg-blue-50"
              >
                Voir les tarifs
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
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
            transactions={transactions || []}
            isLoading={txStatus === "LoadingFirstPage"}
            onLoadMore={() => loadMore(5)}
            hasMore={txStatus === "CanLoadMore"}
            emptyMessage="Aucune transaction pour le moment"
          />
        </CardContent>
      </Card>
    </div>
  )
}
