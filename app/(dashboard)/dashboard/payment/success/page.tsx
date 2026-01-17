"use client"

import { useAction, useConvexAuth, useQuery } from "convex/react"
import {
  ArrowRight,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Home,
  Loader2,
  PartyPopper,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { AccessBadge, getAccessStatus } from "@/components/shared/payments"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { formatCurrency } from "@/lib/format"

type VerificationState = "loading" | "success" | "pending" | "error"

interface VerificationResult {
  success: boolean
  status: string
  customerEmail?: string | null
  metadata?: Record<string, string> | null
  amountTotal?: number | null
  currency?: string | null
}

const PaymentSuccessContent = () => {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  const [state, setState] = useState<VerificationState>(() =>
    sessionId ? "loading" : "error",
  )
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const verifySession = useAction(api.stripe.verifyCheckoutSession)
  // Skip query until authenticated to avoid race condition after Stripe redirect
  const accessStatus = useQuery(
    api.payments.getMyAccessStatus,
    isAuthenticated ? undefined : "skip",
  )

  useEffect(() => {
    // Wait for auth to be ready before verifying
    if (!sessionId || isAuthLoading || !isAuthenticated) return

    let timeoutId: NodeJS.Timeout | undefined
    let isCancelled = false

    const verify = async () => {
      try {
        const res = await verifySession({ sessionId })

        if (isCancelled) return

        const verificationResult: VerificationResult = {
          success: res.success,
          status: String(res.status),
          customerEmail: res.customerEmail,
          metadata: res.metadata,
          amountTotal: res.amountTotal,
          currency: res.currency,
        }
        setResult(verificationResult)

        // payment_status from Stripe is "paid", "unpaid", or "no_payment_required"
        if (res.success) {
          setState("success")
        } else if (String(res.status) === "unpaid") {
          // Webhook might not have processed yet
          if (retryCount < 3) {
            setState("pending")
            timeoutId = setTimeout(() => {
              if (!isCancelled) {
                setRetryCount((c) => c + 1)
              }
            }, 2000)
          } else {
            setState("pending")
          }
        } else {
          setState("error")
        }
      } catch (error) {
        if (isCancelled) return
        console.error("Verification error:", error)
        toast.error("Erreur lors de la vérification du paiement")
        setState("error")
      }
    }

    verify()

    return () => {
      isCancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [sessionId, retryCount, verifySession, isAuthLoading, isAuthenticated])

  const handleRetry = () => {
    setState("loading")
    setRetryCount(0)
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {/* Loading State */}
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center"
          >
            <div className="mb-8 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
              Vérification du paiement...
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Veuillez patienter pendant que nous confirmons votre transaction
            </p>
          </motion.div>
        )}

        {/* Success State */}
        {state === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-lg"
          >
            {/* Success animation */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/30"
                >
                  <CheckCircle className="h-14 w-14 text-white" />
                </motion.div>
                {/* Confetti effect */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-4 -right-4"
                >
                  <PartyPopper className="h-8 w-8 text-yellow-500" />
                </motion.div>
              </div>
            </div>

            <div className="text-center">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-3 text-3xl font-bold text-gray-900 dark:text-white"
              >
                Paiement réussi !
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-8 text-gray-600 dark:text-gray-400"
              >
                Merci pour votre achat. Votre accès a été activé instantanément.
              </motion.p>
            </div>

            {/* Payment details card */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="border-b border-gray-100 bg-gray-50/80 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/80">
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Détails de la transaction
                  </h2>
                </div>
                <div className="space-y-4 p-6">
                  {result.amountTotal && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <CreditCard className="h-4 w-4" />
                        Montant payé
                      </span>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(
                          result.amountTotal,
                          result.currency || "CAD",
                        )}
                      </span>
                    </div>
                  )}
                  {result.customerEmail && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <FileText className="h-4 w-4" />
                        Reçu envoyé à
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {result.customerEmail}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Access status */}
            {accessStatus && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mb-8 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:from-blue-950/30 dark:to-indigo-950/30"
              >
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
                  Vos accès actifs
                </h3>
                <div className="flex flex-wrap gap-3">
                  {accessStatus.examAccess && (
                    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
                      <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        Examens Simulés
                      </div>
                      <AccessBadge
                        accessType="exam"
                        status={getAccessStatus(
                          accessStatus.examAccess.expiresAt,
                          accessStatus.examAccess.daysRemaining,
                        )}
                        daysRemaining={accessStatus.examAccess.daysRemaining}
                        expiresAt={accessStatus.examAccess.expiresAt}
                        showDetails
                      />
                    </div>
                  )}
                  {accessStatus.trainingAccess && (
                    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
                      <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        Banque d{"'"}Entraînement
                      </div>
                      <AccessBadge
                        accessType="training"
                        status={getAccessStatus(
                          accessStatus.trainingAccess.expiresAt,
                          accessStatus.trainingAccess.daysRemaining,
                        )}
                        daysRemaining={
                          accessStatus.trainingAccess.daysRemaining
                        }
                        expiresAt={accessStatus.trainingAccess.expiresAt}
                        showDetails
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <Link href="/dashboard" className="flex-1">
                <Button
                  size="lg"
                  className="h-14 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-bold text-white hover:opacity-90"
                >
                  Aller au tableau de bord
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard/abonnements" className="flex-1">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-full rounded-2xl text-base font-medium"
                >
                  Voir mon abonnement
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        )}

        {/* Pending State */}
        {state === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-lg text-center"
          >
            <div className="mb-8 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50">
                <Clock className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
            </div>

            <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
              Paiement en cours de traitement
            </h1>
            <p className="mb-8 text-gray-600 dark:text-gray-400">
              Votre paiement a été reçu et est en cours de traitement. L{"'"}
              accès sera activé sous quelques instants.
            </p>

            <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Si votre accès n{"'"}est pas activé dans les prochaines minutes,
                veuillez rafraîchir la page ou nous contacter.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={handleRetry}
                className="h-14 flex-1 rounded-2xl"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Vérifier à nouveau
              </Button>
              <Link href="/dashboard" className="flex-1">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-full rounded-2xl"
                >
                  <Home className="mr-2 h-5 w-5" />
                  Retour au dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-lg text-center"
          >
            <div className="mb-8 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/50 dark:to-rose-900/50">
                <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
              Erreur de vérification
            </h1>
            <p className="mb-8 text-gray-600 dark:text-gray-400">
              {!sessionId
                ? "Aucun identifiant de session trouvé. Veuillez réessayer votre achat."
                : "Nous n'avons pas pu vérifier votre paiement. Si vous avez été débité, contactez-nous."}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/tarifs" className="flex-1">
                <Button
                  size="lg"
                  className="h-14 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                >
                  Réessayer l{"'"}achat
                </Button>
              </Link>
              <Link href="/dashboard" className="flex-1">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-full rounded-2xl"
                >
                  Retour au dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const LoadingFallback = () => (
  <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
    <div className="text-center">
      <Skeleton className="mx-auto mb-8 h-24 w-24 rounded-3xl" />
      <Skeleton className="mx-auto mb-3 h-8 w-64" />
      <Skeleton className="mx-auto h-4 w-80" />
    </div>
  </div>
)

export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <Suspense fallback={<LoadingFallback />}>
        <PaymentSuccessContent />
      </Suspense>
    </div>
  )
}
