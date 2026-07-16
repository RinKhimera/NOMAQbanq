"use client"

import {
  IconClipboardCheck,
  IconCoin,
  IconCurrencyDollar,
  IconSparkles,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react"
import {
  AnimatedStatCardSkeleton,
  AnimatedStatCard as StatCard,
} from "@/components/admin/animated-stat-card"
import { cn } from "@/lib/utils"

interface CurrencyRevenue {
  recent: number
  previous: number
  trend: number
}

interface UsersStatsRowProps {
  stats: {
    totalUsers: number
    newThisMonth: number
    newThisMonthTrend: number
    activeExamAccess: number
    examExpiringCount: number
    activeTrainingAccess: number
    trainingExpiringCount: number
    revenueByCurrency: {
      CAD: CurrencyRevenue
      XAF: CurrencyRevenue
    }
  } | null
  isLoading?: boolean
}

export function UsersStatsRow({ stats, isLoading }: UsersStatsRowProps) {
  const formatCAD = (amount: number) => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)
  }

  const formatXAF = (amount: number) => {
    return (
      new Intl.NumberFormat("fr-FR", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount / 100) + " XAF"
    )
  }

  // Parenthèses indispensables : `??` est MOINS prioritaire que `>`, donc
  // `recent ?? 0 > 0` parse `recent ?? (0 > 0)` → vaut le NOMBRE `recent` (0 si
  // pas de revenu XAF) au lieu d'un booléen → `{hasXAFRevenue && …}` rendait « 0 ».
  const hasXAFRevenue = (stats?.revenueByCurrency.XAF.recent ?? 0) > 0

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <AnimatedStatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        hasXAFRevenue ? "lg:grid-cols-6" : "lg:grid-cols-5",
      )}
    >
      <StatCard
        label="Total utilisateurs"
        value={stats.totalUsers.toLocaleString("fr-CA")}
        color="emerald"
        delay={0}
        icon={<IconUsers className="h-5 w-5" />}
      />

      <StatCard
        label="Nouveaux ce mois"
        value={stats.newThisMonth}
        trend={
          stats.newThisMonthTrend !== 0
            ? {
                value: stats.newThisMonthTrend,
                isPositive: stats.newThisMonthTrend > 0,
              }
            : undefined
        }
        color="blue"
        delay={0.05}
        subtitle="vs mois dernier"
        icon={<IconUserPlus className="h-5 w-5" />}
      />

      <StatCard
        label="Accès examens actifs"
        value={stats.activeExamAccess}
        color="amber"
        delay={0.1}
        subtitle={
          stats.examExpiringCount > 0
            ? `${stats.examExpiringCount} expire${stats.examExpiringCount > 1 ? "nt" : ""} dans 7j`
            : undefined
        }
        icon={<IconClipboardCheck className="h-5 w-5" />}
      />

      <StatCard
        label="Accès entraînement actifs"
        value={stats.activeTrainingAccess}
        color="teal"
        delay={0.15}
        subtitle={
          stats.trainingExpiringCount > 0
            ? `${stats.trainingExpiringCount} expire${stats.trainingExpiringCount > 1 ? "nt" : ""} dans 7j`
            : undefined
        }
        icon={<IconSparkles className="h-5 w-5" />}
      />

      <StatCard
        label="Revenus CAD (30j)"
        value={formatCAD(stats.revenueByCurrency.CAD.recent)}
        trend={
          stats.revenueByCurrency.CAD.trend !== 0
            ? {
                value: stats.revenueByCurrency.CAD.trend,
                isPositive: stats.revenueByCurrency.CAD.trend > 0,
              }
            : undefined
        }
        color="slate"
        delay={0.2}
        subtitle="vs 30 jours précédents"
        icon={<IconCurrencyDollar className="h-5 w-5" />}
      />

      {hasXAFRevenue && (
        <StatCard
          label="Revenus XAF (30j)"
          value={formatXAF(stats.revenueByCurrency.XAF.recent)}
          trend={
            stats.revenueByCurrency.XAF.trend !== 0
              ? {
                  value: stats.revenueByCurrency.XAF.trend,
                  isPositive: stats.revenueByCurrency.XAF.trend > 0,
                }
              : undefined
          }
          color="teal"
          delay={0.25}
          subtitle="vs 30 jours précédents"
          icon={<IconCoin className="h-5 w-5" />}
        />
      )}
    </div>
  )
}
