"use client"

import { useAction, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { AlertCircle, PackageX, Sparkles, Zap } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import {
  AccessBadge,
  getAccessStatus,
} from "@/components/shared/payments/access-badge"
import { PremiumPricingCard } from "@/components/shared/payments/premium-pricing-card"
import { PricingCard } from "@/components/shared/payments/pricing-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/convex/_generated/api"
import type { ErrorCode } from "@/convex/lib/errors"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { cn } from "@/lib/utils"

type AccessFilter = "all" | "exam" | "training"

export const PricingGrid = () => {
  const [filter, setFilter] = useState<AccessFilter>("all")
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null)
  const router = useRouter()

  const { isAuthenticated, isLoading: isAuthLoading } = useCurrentUser()
  const products = useQuery(api.payments.getAvailableProducts)
  const accessStatus = useQuery(
    api.payments.getMyAccessStatus,
    isAuthenticated ? {} : "skip",
  )
  const createCheckout = useAction(api.stripe.createCheckoutSession)

  const handlePurchase = async (productCode: string) => {
    // Attendre que l'état d'authentification soit déterminé
    if (isAuthLoading) {
      return
    }

    // Rediriger vers l'authentification si non connecté
    if (!isAuthenticated) {
      router.push("/auth/sign-up")
      return
    }

    setLoadingProduct(productCode)
    try {
      const { checkoutUrl } = await createCheckout({
        productCode: productCode as
          | "exam_access"
          | "training_access"
          | "exam_access_promo"
          | "training_access_promo"
          | "premium_access",
        successUrl: `${window.location.origin}/dashboard/payment/success`,
        cancelUrl: `${window.location.origin}/tarifs`,
      })

      if (checkoutUrl) {
        window.location.href = checkoutUrl
      }
    } catch (error) {
      console.error("Erreur lors de la création du checkout:", error)

      // Gérer l'erreur d'authentification (défense en profondeur)
      if (error instanceof ConvexError) {
        const data = error.data as { code?: ErrorCode; message?: string }
        if (data.code === "UNAUTHENTICATED") {
          router.push("/auth/sign-up")
          return
        }
      }

      if (!navigator.onLine) {
        toast.error("Pas de connexion internet. Vérifiez votre réseau.")
      } else if (error instanceof Error && error.message) {
        toast.error(error.message)
      } else {
        toast.error("Une erreur est survenue. Veuillez réessayer.")
      }
    } finally {
      setLoadingProduct(null)
    }
  }

  // Séparer le produit premium des produits réguliers
  const premiumProduct = products?.find((p) => p.code === "premium_access")
  const regularProducts = products?.filter((p) => p.code !== "premium_access")

  // Filtrer les produits réguliers (le premium apparaît toujours au-dessus)
  const filteredProducts = regularProducts?.filter((p) => {
    if (filter === "all") return true
    return p.accessType === filter
  })

  // Sort products: promo (6 months) first for each type
  const sortedProducts = filteredProducts?.toSorted((a, b) => {
    if (a.accessType !== b.accessType) {
      return a.accessType === "exam" ? -1 : 1
    }
    return b.durationDays - a.durationDays // Longer duration first
  })

  const isPopular = (code: string) => code.includes("promo")

  const getCurrentAccess = (accessType: "exam" | "training") => {
    if (!accessStatus) return null
    return accessType === "exam"
      ? accessStatus.examAccess
      : accessStatus.trainingAccess
  }

  if (!products) {
    return (
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex justify-center">
            <Skeleton className="h-12 w-80 rounded-full" />
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-3xl border p-8">
                <Skeleton className="mb-4 h-8 w-32" />
                <Skeleton className="mb-2 h-12 w-24" />
                <Skeleton className="mb-6 h-4 w-full" />
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <Skeleton className="mt-8 h-14 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    return (
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 py-20 dark:border-gray-700"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
              <PackageX className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
              Aucune offre disponible
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Les offres seront bientôt disponibles. Revenez plus tard.
            </p>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Current access status banner */}
        {isAuthenticated &&
          accessStatus &&
          (accessStatus.examAccess || accessStatus.trainingAccess) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12 rounded-2xl bg-linear-to-r from-blue-50 to-indigo-50 p-6 dark:from-blue-950/30 dark:to-indigo-950/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    Vos accès actuels
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {accessStatus.examAccess && (
                    <AccessBadge
                      accessType="exam"
                      status={getAccessStatus(
                        accessStatus.examAccess.expiresAt,
                        accessStatus.examAccess.daysRemaining,
                      )}
                      daysRemaining={accessStatus.examAccess.daysRemaining}
                      showDetails
                      size="md"
                    />
                  )}
                  {accessStatus.trainingAccess && (
                    <AccessBadge
                      accessType="training"
                      status={getAccessStatus(
                        accessStatus.trainingAccess.expiresAt,
                        accessStatus.trainingAccess.daysRemaining,
                      )}
                      daysRemaining={accessStatus.trainingAccess.daysRemaining}
                      showDetails
                      size="md"
                    />
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Prolongez votre accès avant expiration pour cumuler le temps
                restant avec le nouvel achat.
              </p>
            </motion.div>
          )}

        {/* Premium product featured section */}
        {premiumProduct && (
          <div className="mb-16">
            <PremiumPricingCard
              product={premiumProduct}
              examAccess={accessStatus?.examAccess}
              trainingAccess={accessStatus?.trainingAccess}
              onPurchase={() => handlePurchase(premiumProduct.code)}
              isLoading={loadingProduct === premiumProduct.code}
            />
          </div>
        )}

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex justify-center"
        >
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as AccessFilter)}
            aria-label="Filtrer les offres par type"
          >
            <TabsList className="h-14 rounded-full bg-gray-100 p-1.5 dark:bg-gray-800">
              <TabsTrigger
                value="all"
                aria-label="Afficher toutes les offres"
                className={cn(
                  "cursor-pointer rounded-full px-6 py-2.5 text-sm font-medium transition-all",
                  filter === "all" && "bg-white shadow-md dark:bg-gray-700",
                )}
              >
                Toutes les offres
              </TabsTrigger>
              <TabsTrigger
                value="exam"
                aria-label="Filtrer par examens simulés"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all",
                  filter === "exam" && "bg-white shadow-md dark:bg-gray-700",
                )}
              >
                <Zap className="h-4 w-4" aria-hidden="true" />
                Examens
              </TabsTrigger>
              <TabsTrigger
                value="training"
                aria-label="Filtrer par banque d'entraînement"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all",
                  filter === "training" &&
                    "bg-white shadow-md dark:bg-gray-700",
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Entraînement
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Products grid */}
        <div
          className={cn(
            "grid gap-8",
            filter === "all"
              ? "md:grid-cols-2 lg:grid-cols-4"
              : "mx-auto max-w-3xl md:grid-cols-2",
          )}
        >
          {sortedProducts?.map((product, index) => (
            <PricingCard
              key={product._id}
              product={product}
              isPopular={isPopular(product.code)}
              currentAccess={getCurrentAccess(product.accessType)}
              onPurchase={() => handlePurchase(product.code)}
              isLoading={loadingProduct === product.code}
              index={index}
            />
          ))}
        </div>

        {/* FAQ teaser */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-600 dark:text-gray-400">
            Des questions ?{" "}
            <a
              href="/faq"
              className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            >
              Consultez notre FAQ
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
