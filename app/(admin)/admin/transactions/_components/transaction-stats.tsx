"use client"

import { motion } from "motion/react"
import { useQuery } from "convex/react"
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  Coins
} from "lucide-react"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"

interface StatCardConfig {
  key: string
  label: string
  icon: typeof DollarSign
  gradient: string
  bgGradient: string
  format: (value: number) => string
}

export const TransactionStats = () => {
  const stats = useQuery(api.payments.getTransactionStats)

  if (stats === undefined) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border bg-white p-6 dark:bg-gray-900"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const hasXAFRevenue = stats.revenueByCurrency.XAF.total > 0

  // Construction déclarative des cartes selon les devises présentes (pattern React idiomatique)
  const statCards: StatCardConfig[] = [
    {
      key: "totalRevenueCAD",
      label: "Revenus totaux CAD",
      icon: DollarSign,
      gradient: "from-emerald-500 to-teal-600",
      bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
      format: (value: number) => formatCurrency(value, "CAD"),
    },
    ...(hasXAFRevenue
      ? [
          {
            key: "totalRevenueXAF",
            label: "Revenus totaux XAF",
            icon: Coins,
            gradient: "from-teal-500 to-cyan-600",
            bgGradient:
              "from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30",
            format: (value: number) => formatCurrency(value, "XAF"),
          } as StatCardConfig,
        ]
      : []),
    {
      key: "recentRevenueCAD",
      label: "30 jours CAD",
      icon: TrendingUp,
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
      format: (value: number) => formatCurrency(value, "CAD"),
    },
    ...(hasXAFRevenue
      ? [
          {
            key: "recentRevenueXAF",
            label: "30 jours XAF",
            icon: TrendingUp,
            gradient: "from-cyan-500 to-blue-600",
            bgGradient:
              "from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30",
            format: (value: number) => formatCurrency(value, "XAF"),
          } as StatCardConfig,
        ]
      : []),
    {
      key: "stripeTransactions",
      label: "Transactions Stripe",
      icon: CreditCard,
      gradient: "from-violet-500 to-purple-600",
      bgGradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
      format: (value: number) => value.toString(),
    },
    {
      key: "manualTransactions",
      label: "Paiements manuels",
      icon: Banknote,
      gradient: "from-amber-500 to-orange-600",
      bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
      format: (value: number) => value.toString(),
    },
  ]

  // Mapper les clés vers les valeurs
  const getValue = (key: string): number => {
    switch (key) {
      case "totalRevenueCAD":
        return stats.revenueByCurrency.CAD.total
      case "totalRevenueXAF":
        return stats.revenueByCurrency.XAF.total
      case "recentRevenueCAD":
        return stats.revenueByCurrency.CAD.recent
      case "recentRevenueXAF":
        return stats.revenueByCurrency.XAF.recent
      case "stripeTransactions":
        return stats.stripeTransactions
      case "manualTransactions":
        return stats.manualTransactions
      default:
        return 0
    }
  }

  return (
    <div className={cn(
      "grid gap-6 md:grid-cols-2",
      hasXAFRevenue ? "lg:grid-cols-3" : "lg:grid-cols-4"
    )}>
      {statCards.map((card, index) => {
        const Icon = card.icon
        const value = getValue(card.key)

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:bg-gray-900",
              "border-gray-200/80 dark:border-gray-700/50"
            )}
          >
            {/* Background gradient on hover */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                card.bgGradient
              )}
            />

            <div className="relative flex items-center gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                  card.gradient
                )}
              >
                <Icon className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {card.format(value)}
                </p>
              </div>
            </div>

            {/* Decorative corner */}
            <div
              className={cn(
                "absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-10 blur-2xl",
                card.gradient
              )}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
