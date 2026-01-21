"use client"

import { useRef, useEffect } from "react"
import { motion } from "motion/react"
import { Check, Crown, Sparkles, Zap, Clock, ArrowRight } from "lucide-react"
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
}

interface CurrentAccess {
  expiresAt: number
  daysRemaining: number
}

interface PricingCardProps {
  product: Product
  isPopular?: boolean
  currentAccess?: CurrentAccess | null
  onPurchase: () => void
  isLoading?: boolean
  index?: number
}

const accessTypeConfig = {
  exam: {
    gradient: "from-blue-600 via-indigo-600 to-violet-600",
    lightGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50",
    accentColor: "text-blue-600 dark:text-blue-400",
    borderAccent: "border-blue-500/20",
    icon: Zap,
    label: "Examens Simulés",
    features: [
      "Accès aux examens blancs complets",
      "Mode chronométré réaliste",
      "Correction détaillée",
      "Statistiques de performance",
    ],
  },
  training: {
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    lightGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    borderAccent: "border-emerald-500/20",
    icon: Sparkles,
    label: "Banque d'Entraînement",
    features: [
      "5000+ questions d'entraînement",
      "Mode tuteur avec explications",
      "Filtrage par domaine médical",
      "Suivi de progression",
    ],
  },
}

export const PricingCard = ({
  product,
  isPopular = false,
  currentAccess,
  onPurchase,
  isLoading = false,
  index = 0,
}: PricingCardProps) => {
  const config = accessTypeConfig[product.accessType]
  const Icon = config.icon
  const hasAccess = !!currentAccess
  const accessStatus = getAccessStatus(currentAccess?.expiresAt, currentAccess?.daysRemaining)

  const isPromo = product.code.includes("promo")
  const savings = isPromo ? Math.round((1 - (product.priceCAD / (50 * 100 * 6))) * 100) : 0

  // Protection contre le double-clic
  const isClickedRef = useRef(false)

  useEffect(() => {
    if (!isLoading) {
      isClickedRef.current = false
    }
  }, [isLoading])

  const handlePurchaseClick = () => {
    if (isClickedRef.current || isLoading) return
    isClickedRef.current = true
    onPurchase()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1]
      }}
      className="group relative"
    >
      {/* Popular badge - floating above card */}
      {isPopular && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
          className="absolute -top-4 left-1/2 z-20 -translate-x-1/2"
        >
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold text-white shadow-lg",
            "bg-gradient-to-r",
            config.gradient
          )}>
            <Crown className="h-4 w-4" />
            Populaire
          </div>
        </motion.div>
      )}

      {/* Card container */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border-2 bg-white transition-all duration-500",
          "dark:bg-gray-900",
          isPopular
            ? "border-transparent shadow-2xl shadow-blue-500/20 dark:shadow-blue-500/10"
            : "border-gray-200/80 dark:border-gray-700/50 shadow-xl",
          "hover:shadow-2xl hover:-translate-y-2",
          isPopular && "ring-2 ring-blue-500/20 dark:ring-blue-400/20"
        )}
      >
        {/* Gradient background overlay for popular */}
        {isPopular && (
          <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.08]",
            "bg-gradient-to-br",
            config.gradient
          )} />
        )}

        {/* Decorative corner gradient */}
        <div className={cn(
          "absolute -right-20 -top-20 h-40 w-40 rounded-full blur-3xl opacity-30 transition-opacity duration-500",
          "bg-gradient-to-br",
          config.gradient,
          "group-hover:opacity-50"
        )} />

        {/* Content */}
        <div className="relative p-8">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="space-y-2">
              <div className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold",
                "bg-gradient-to-r",
                config.lightGradient,
                config.accentColor
              )}>
                <Icon className="h-4 w-4" />
                {config.label}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {product.name}
              </h3>
            </div>

            {/* Duration badge */}
            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              {product.durationDays} jours
            </div>
          </div>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-5xl font-black tracking-tight",
                config.accentColor
              )}>
                {formatCurrency(product.priceCAD)}
              </span>
              {isPromo && (
                <span className="rounded-full bg-green-100 px-2.5 py-1 text-sm font-bold text-green-700 dark:bg-green-900/50 dark:text-green-300">
                  -{savings}%
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {product.description}
            </p>
          </div>

          {/* Current access status */}
          {hasAccess && (
            <div className="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Votre accès actuel
                </span>
                <AccessBadge
                  accessType={product.accessType}
                  status={accessStatus}
                  daysRemaining={currentAccess?.daysRemaining}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* Features */}
          <ul className="mb-8 space-y-3">
            {config.features.map((feature, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 + i * 0.05 }}
                className="flex items-start gap-3"
              >
                <div className={cn(
                  "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                  "bg-gradient-to-br",
                  config.gradient
                )}>
                  <Check className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {feature}
                </span>
              </motion.li>
            ))}
          </ul>

          {/* CTA Button */}
          <Button
            onClick={handlePurchaseClick}
            disabled={isLoading}
            className={cn(
              "w-full h-14 text-base font-bold rounded-2xl transition-all duration-300",
              "shadow-lg hover:shadow-xl",
              isPopular
                ? cn("bg-gradient-to-r text-white hover:opacity-90", config.gradient)
                : "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Chargement...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {hasAccess ? "Prolonger l'accès" : "Acheter maintenant"}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </Button>

          {/* Trust indicator */}
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Paiement sécurisé par Stripe · Accès instantané
          </p>
        </div>
      </div>
    </motion.div>
  )
}
