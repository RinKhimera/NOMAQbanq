"use client"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import {
  IconUsers,
  IconUserPlus,
  IconClipboardCheck,
  IconSparkles,
  IconCurrencyDollar,
  IconCoin,
} from "@tabler/icons-react"

interface StatCardProps {
  label: string
  value: string | number
  trend?: {
    value: number
    isPositive: boolean
  }
  color: "emerald" | "blue" | "amber" | "teal" | "slate"
  delay?: number
  subtitle?: string
  icon: React.ReactNode
}

const colorVariants = {
  emerald: {
    bg: "from-emerald-500/10 via-emerald-400/5 to-transparent",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200/60 dark:border-emerald-700/40",
    glow: "group-hover:shadow-emerald-500/10",
    accent: "from-emerald-500 to-emerald-600",
  },
  blue: {
    bg: "from-blue-500/10 via-blue-400/5 to-transparent",
    iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200/60 dark:border-blue-700/40",
    glow: "group-hover:shadow-blue-500/10",
    accent: "from-blue-500 to-blue-600",
  },
  amber: {
    bg: "from-amber-500/10 via-amber-400/5 to-transparent",
    iconBg: "bg-amber-500/10 dark:bg-amber-400/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200/60 dark:border-amber-700/40",
    glow: "group-hover:shadow-amber-500/10",
    accent: "from-amber-500 to-amber-600",
  },
  teal: {
    bg: "from-teal-500/10 via-teal-400/5 to-transparent",
    iconBg: "bg-teal-500/10 dark:bg-teal-400/10",
    iconColor: "text-teal-600 dark:text-teal-400",
    border: "border-teal-200/60 dark:border-teal-700/40",
    glow: "group-hover:shadow-teal-500/10",
    accent: "from-teal-500 to-teal-600",
  },
  slate: {
    bg: "from-slate-500/10 via-slate-400/5 to-transparent",
    iconBg: "bg-slate-500/10 dark:bg-slate-400/10",
    iconColor: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200/60 dark:border-slate-700/40",
    glow: "group-hover:shadow-slate-500/10",
    accent: "from-slate-500 to-slate-600",
  },
}

function StatCard({
  label,
  value,
  trend,
  color,
  delay = 0,
  subtitle,
  icon,
}: StatCardProps) {
  const colors = colorVariants[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group h-full"
    >
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-2xl border bg-linear-to-br p-5 transition-all duration-300",
          "bg-white/90 backdrop-blur-sm dark:bg-gray-900/90",
          colors.border,
          colors.bg,
          "hover:-translate-y-0.5 hover:shadow-lg",
          colors.glow,
        )}
      >
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Glow effect on hover */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-linear-to-br from-current to-transparent opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />

        {/* Header */}
        <div className="relative mb-3 flex items-center justify-between">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              colors.iconBg,
            )}
          >
            <div className={cn("h-5 w-5", colors.iconColor)}>{icon}</div>
          </div>

          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
                trend.isPositive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
              )}
            >
              <svg
                className={cn("h-3 w-3", !trend.isPositive && "rotate-180")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              {Math.abs(trend.value).toFixed(0)}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="relative mb-1">
          <span className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {value}
          </span>
        </div>

        {/* Label */}
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </p>

        {/* Subtitle - always reserve space for consistent height */}
        <p className={cn(
          "mt-1 text-xs text-gray-500 dark:text-gray-500",
          !subtitle && "invisible"
        )}>
          {subtitle || "placeholder"}
        </p>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 h-0.75 w-full overflow-hidden">
          <div
            className={cn(
              "h-full w-0 bg-linear-to-r transition-all duration-500 group-hover:w-full",
              colors.accent,
            )}
          />
        </div>
      </div>
    </motion.div>
  )
}

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
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100) + " XAF"
  }

  const hasXAFRevenue = stats?.revenueByCurrency.XAF.recent ?? 0 > 0

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-39 animate-pulse rounded-2xl border border-gray-200/60 bg-gray-100/50 dark:border-gray-700/40 dark:bg-gray-800/50"
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn(
      "grid grid-cols-1 gap-4 sm:grid-cols-2",
      hasXAFRevenue ? "lg:grid-cols-6" : "lg:grid-cols-5"
    )}>
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
            ? { value: stats.revenueByCurrency.CAD.trend, isPositive: stats.revenueByCurrency.CAD.trend > 0 }
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
              ? { value: stats.revenueByCurrency.XAF.trend, isPositive: stats.revenueByCurrency.XAF.trend > 0 }
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
