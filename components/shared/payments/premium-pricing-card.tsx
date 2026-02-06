"use client"

import { useRef, useEffect } from "react"
import { motion } from "motion/react"
import {
  Check,
  Crown,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  Star,
  Gift,
  Shield,
  TrendingUp,
} from "lucide-react"
// cn is available but not currently used - keeping import for future styling needs
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { AccessBadge, getAccessStatus } from "./access-badge"

interface Product {
  _id: string
  code: string
  name: string
  description: string
  priceCAD: number
  durationDays: number
  accessType: "exam" | "training"
  isCombo?: boolean
}

interface CurrentAccess {
  expiresAt: number
  daysRemaining: number
}

interface PremiumPricingCardProps {
  product: Product
  examAccess?: CurrentAccess | null
  trainingAccess?: CurrentAccess | null
  onPurchase: () => void
  isLoading?: boolean
}

// Features split by category for visual distinction
const examFeatures = [
  "Accès complet aux examens blancs",
  "Mode chronométré réaliste",
  "Correction détaillée après chaque examen",
]

const trainingFeatures = [
  "5000+ questions d'entraînement",
  "Mode tuteur avec explications",
  "Filtrage par domaine médical",
]

const sharedFeatures = [
  "Statistiques de performance avancées",
  "Support prioritaire",
]

export const PremiumPricingCard = ({
  product,
  examAccess,
  trainingAccess,
  onPurchase,
  isLoading = false,
}: PremiumPricingCardProps) => {
  // Price comparison: 6 months of both = 6×50$ exam + 6×50$ training = 600$
  const regularPrice = 60000 // 600$ in cents
  const savings = Math.round((1 - product.priceCAD / regularPrice) * 100)
  const savedAmount = regularPrice - product.priceCAD

  const hasAnyAccess = !!examAccess || !!trainingAccess

  // Double-click protection
  const isClickedRef = useRef(false)
  useEffect(() => {
    if (!isLoading) isClickedRef.current = false
  }, [isLoading])

  const handleClick = () => {
    if (isClickedRef.current || isLoading) return
    isClickedRef.current = true
    onPurchase()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative"
    >
      {/* Floating badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5, ease: "backOut" }}
        className="absolute -top-5 left-1/2 z-20 -translate-x-1/2"
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-linear-to-r from-amber-400 via-orange-500 to-rose-500 opacity-75 blur-lg" />
          <div className="relative flex items-center gap-2 rounded-full bg-linear-to-r from-amber-500 via-orange-500 to-rose-500 px-6 py-2.5 text-sm font-bold text-white shadow-2xl">
            <Star className="h-4 w-4 fill-current" />
            <span className="tracking-wide">MEILLEURE OFFRE</span>
            <Gift className="h-4 w-4" />
          </div>
        </div>
      </motion.div>

      {/* Main card container */}
      <div className="relative overflow-hidden rounded-4xl border-2 border-amber-400/30 bg-linear-to-br from-amber-50 via-white to-orange-50 shadow-[0_20px_70px_-15px_rgba(251,191,36,0.3)] dark:border-amber-500/20 dark:from-gray-900 dark:via-gray-900 dark:to-amber-950/30 dark:shadow-[0_20px_70px_-15px_rgba(251,191,36,0.15)]">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Top right gradient orb */}
          <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-linear-to-br from-amber-400/40 via-orange-400/30 to-transparent blur-3xl dark:from-amber-500/20 dark:via-orange-500/15" />
          {/* Bottom left gradient orb */}
          <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-linear-to-tr from-rose-400/30 via-orange-400/20 to-transparent blur-3xl dark:from-rose-500/15 dark:via-orange-500/10" />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(251,191,36,1) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,1) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
            {/* Left column: Info & CTA (3 cols) */}
            <div className="lg:col-span-3">
              {/* Header */}
              <div className="mb-8 flex items-start gap-4">
                <motion.div
                  initial={{ rotate: -10, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 via-orange-500 to-rose-500 shadow-lg shadow-amber-500/30"
                >
                  <Crown className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white lg:text-3xl">
                    {product.name}
                  </h3>
                  <p className="mt-1 flex items-center gap-2 text-base text-gray-600 dark:text-gray-400">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <span>Examens</span>
                    <span className="text-gray-400">+</span>
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    <span>Entraînement</span>
                  </p>
                </div>
              </div>

              {/* Price block */}
              <div className="mb-8">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="bg-linear-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-5xl font-black tracking-tight text-transparent lg:text-6xl">
                    {formatCurrency(product.priceCAD)}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-xl text-gray-400 line-through dark:text-gray-500">
                      {formatCurrency(regularPrice)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-3 py-1 text-sm font-bold text-white shadow-lg shadow-emerald-500/30">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Économisez {savings}%
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-gray-600 dark:text-gray-400">
                  {product.description}
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>Valide {product.durationDays} jours</span>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Vous économisez {formatCurrency(savedAmount)}
                  </span>
                </div>
              </div>

              {/* Current access display */}
              {hasAnyAccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-8 rounded-2xl border border-amber-200/50 bg-white/60 p-5 backdrop-blur-sm dark:border-amber-500/20 dark:bg-gray-800/40"
                >
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <Shield className="h-4 w-4 text-amber-500" />
                    Vos accès actuels
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Examens:
                      </span>
                      {examAccess ? (
                        <AccessBadge
                          accessType="exam"
                          status={getAccessStatus(
                            examAccess.expiresAt,
                            examAccess.daysRemaining
                          )}
                          daysRemaining={examAccess.daysRemaining}
                          size="sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-400">Aucun</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Entraînement:
                      </span>
                      {trainingAccess ? (
                        <AccessBadge
                          accessType="training"
                          status={getAccessStatus(
                            trainingAccess.expiresAt,
                            trainingAccess.daysRemaining
                          )}
                          daysRemaining={trainingAccess.daysRemaining}
                          size="sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-400">Aucun</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* CTA Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  onClick={handleClick}
                  disabled={isLoading}
                  className="group relative h-16 w-full overflow-hidden rounded-2xl bg-linear-to-r from-amber-500 via-orange-500 to-rose-500 text-lg font-bold text-white shadow-xl shadow-orange-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/40"
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                  <span className="relative flex items-center justify-center gap-3">
                    {isLoading ? (
                      <>
                        <span className="h-6 w-6 animate-spin rounded-full border-3 border-white/30 border-t-white" />
                        Chargement...
                      </>
                    ) : (
                      <>
                        {hasAnyAccess
                          ? "Prolonger mes accès"
                          : "Obtenir le Pack Premium"}
                        <ArrowRight className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </Button>
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-gray-400">
                  <Shield className="h-4 w-4" />
                  Paiement sécurisé par Stripe · Accès instantané
                </p>
              </motion.div>
            </div>

            {/* Right column: Features (2 cols) */}
            <div className="lg:col-span-2">
              <div className="h-full rounded-2xl border border-amber-200/50 bg-white/50 p-6 backdrop-blur-sm dark:border-amber-500/20 dark:bg-gray-800/30">
                <h4 className="mb-5 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                  <Gift className="h-5 w-5 text-amber-500" />
                  Tout ce qui est inclus
                </h4>

                {/* Exam features */}
                <div className="mb-5">
                  <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    <Zap className="h-3.5 w-3.5" />
                    Examens Simulés
                  </p>
                  <ul className="space-y-2">
                    {examFeatures.map((feature, i) => (
                      <motion.li
                        key={`exam-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.05 }}
                        className="flex items-start gap-2.5"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {feature}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Training features */}
                <div className="mb-5">
                  <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    Banque d&apos;Entraînement
                  </p>
                  <ul className="space-y-2">
                    {trainingFeatures.map((feature, i) => (
                      <motion.li
                        key={`training-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.65 + i * 0.05 }}
                        className="flex items-start gap-2.5"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {feature}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Shared/Premium features */}
                <div className="border-t border-amber-200/50 pt-5 dark:border-amber-500/20">
                  <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <Crown className="h-3.5 w-3.5" />
                    Bonus Premium
                  </p>
                  <ul className="space-y-2">
                    {sharedFeatures.map((feature, i) => (
                      <motion.li
                        key={`shared-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + i * 0.05 }}
                        className="flex items-start gap-2.5"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {feature}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap gap-4 border-t border-gray-200/50 pt-4 dark:border-gray-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    Examens
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    Entraînement
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="h-3 w-3 rounded-full bg-linear-to-br from-amber-500 to-orange-500" />
                    Premium
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
