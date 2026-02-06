"use client"

import { useAction, useQuery } from "convex/react"
import { ArrowRight, Brain, Check, Loader2, Lock, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useActionState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { formatCurrency } from "@/lib/format"

const FEATURES = [
  "Plus de 5000 questions",
  "Sessions personnalisées (5-20 questions)",
  "Corrections détaillées avec explications",
  "Filtrage par domaine médical",
  "Historique complet de vos performances",
  "Suivi de progression en temps réel",
]

export const TrainingPaywall = () => {
  const products = useQuery(api.payments.getAvailableProducts)
  const createCheckout = useAction(api.stripe.createCheckoutSession)

  // Find the training product (non-promo first, then promo as backup)
  const trainingProduct =
    products?.find(
      (p) => p.accessType === "training" && !p.code.includes("promo"),
    ) ?? products?.find((p) => p.accessType === "training")

  const [, startTransition] = useTransition()
  const [, purchaseAction, isPending] = useActionState(async () => {
    if (!trainingProduct) return null

    try {
      const { checkoutUrl } = await createCheckout({
        productCode: trainingProduct.code as
          | "training_access"
          | "training_access_promo",
        successUrl: `${window.location.origin}/dashboard/entrainement`,
        cancelUrl: `${window.location.origin}/dashboard/entrainement`,
      })

      if (checkoutUrl) {
        window.location.href = checkoutUrl
      }
    } catch (error) {
      console.error("Erreur lors de la création du checkout:", error)
      toast.error("Une erreur est survenue. Veuillez réessayer.")
    }

    return null
  }, null)

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient mesh */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-1/4 -left-1/4 h-150 w-150 rounded-full bg-linear-to-br from-emerald-100/40 to-teal-100/40 blur-3xl dark:from-emerald-900/20 dark:to-teal-900/20" />
        <div className="absolute -right-1/4 -bottom-1/4 h-125 w-125 rounded-full bg-linear-to-br from-cyan-100/30 to-emerald-100/30 blur-3xl dark:from-cyan-900/15 dark:to-emerald-900/15" />
      </div>

      <div className="container mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          {/* Main card */}
          <div className="relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-900/90">
            {/* Decorative gradient */}
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500" />

            <div className="p-8 md:p-12">
              {/* Header */}
              <div className="mb-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30"
                >
                  <Lock className="h-10 w-10 text-white" />
                </motion.div>

                <h1 className="font-display text-3xl font-bold text-gray-900 md:text-4xl dark:text-white">
                  Débloquez l&apos;Entraînement
                </h1>
                <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
                  Accédez à notre banque complète de questions et perfectionnez
                  vos connaissances
                </p>
              </div>

              {/* Features grid */}
              <div className="mb-10 grid gap-3 md:grid-cols-2">
                {FEATURES.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="flex items-center gap-3 rounded-xl bg-gray-50/80 p-3 dark:bg-gray-800/50"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-500">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Price section */}
              {trainingProduct ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-8 rounded-2xl border border-emerald-200/60 bg-linear-to-br from-emerald-50 to-teal-50 p-6 text-center dark:border-emerald-800/40 dark:from-emerald-950/40 dark:to-teal-950/40"
                >
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Accès {trainingProduct.durationDays} jours
                    </span>
                  </div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="font-display text-5xl font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(trainingProduct.priceCAD)}
                    </span>
                    <span className="text-lg text-gray-500 dark:text-gray-400">
                      CAD
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-emerald-600/70 dark:text-emerald-400/70">
                    Paiement unique · Accès instantané
                  </p>
                </motion.div>
              ) : (
                <div className="mb-8 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              )}

              {/* CTA buttons */}
              <div className="space-y-4">
                <Button
                  onClick={() => startTransition(purchaseAction)}
                  disabled={isPending || !trainingProduct}
                  size="lg"
                  className="h-14 w-full rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 text-lg font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-500/30"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Redirection vers le paiement...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-5 w-5" />
                      S&apos;abonner maintenant
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    href="/tarifs"
                    className="inline-flex items-center text-sm text-gray-600 transition-colors hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400"
                  >
                    Voir tous les forfaits
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-8 flex items-center justify-center gap-6 border-t border-gray-200/60 pt-6 dark:border-gray-700/60">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Paiement sécurisé Stripe
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Accès immédiat après paiement
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
