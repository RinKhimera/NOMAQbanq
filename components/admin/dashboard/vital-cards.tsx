"use client"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import {
  IconCurrencyDollar,
  IconUsers,
  IconClipboardCheck,
  IconAlertTriangle,
} from "@tabler/icons-react"

interface VitalCardProps {
  label: string
  value: string | number
  trend?: {
    value: number
    isPositive: boolean
  }
  color: "slate" | "emerald" | "amber" | "rose"
  delay?: number
  subtitle?: string
  alert?: boolean
}

const colorVariants = {
  slate: {
    bg: "from-slate-500/10 via-slate-400/5 to-transparent",
    iconBg: "bg-slate-500/10 dark:bg-slate-400/10",
    iconColor: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200/60 dark:border-slate-700/40",
    glow: "group-hover:shadow-slate-500/10",
    accent: "from-slate-500 to-slate-600",
  },
  emerald: {
    bg: "from-emerald-500/10 via-emerald-400/5 to-transparent",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200/60 dark:border-emerald-700/40",
    glow: "group-hover:shadow-emerald-500/10",
    accent: "from-emerald-500 to-emerald-600",
  },
  amber: {
    bg: "from-amber-500/10 via-amber-400/5 to-transparent",
    iconBg: "bg-amber-500/10 dark:bg-amber-400/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200/60 dark:border-amber-700/40",
    glow: "group-hover:shadow-amber-500/10",
    accent: "from-amber-500 to-amber-600",
  },
  rose: {
    bg: "from-rose-500/10 via-rose-400/5 to-transparent",
    iconBg: "bg-rose-500/10 dark:bg-rose-400/10",
    iconColor: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200/60 dark:border-rose-700/40",
    glow: "group-hover:shadow-rose-500/10",
    accent: "from-rose-500 to-rose-600",
  },
}

function VitalCard({
  label,
  value,
  trend,
  color,
  delay = 0,
  subtitle,
  alert,
}: VitalCardProps) {
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
      className="group"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300",
          "bg-white/90 backdrop-blur-sm dark:bg-gray-900/90",
          colors.border,
          colors.bg,
          "hover:translate-y-[-2px] hover:shadow-lg",
          colors.glow
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
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-current to-transparent opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />

        {/* Header */}
        <div className="relative mb-3 flex items-center justify-between">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              colors.iconBg
            )}
          >
            {color === "slate" && (
              <IconCurrencyDollar className={cn("h-5 w-5", colors.iconColor)} />
            )}
            {color === "emerald" && (
              <IconUsers className={cn("h-5 w-5", colors.iconColor)} />
            )}
            {color === "amber" && (
              <IconClipboardCheck className={cn("h-5 w-5", colors.iconColor)} />
            )}
            {color === "rose" && (
              <IconAlertTriangle className={cn("h-5 w-5", colors.iconColor)} />
            )}
          </div>

          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
                trend.isPositive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
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
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}

          {alert && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
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

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            {subtitle}
          </p>
        )}

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 h-[3px] w-full overflow-hidden">
          <div
            className={cn(
              "h-full w-0 bg-gradient-to-r transition-all duration-500 group-hover:w-full",
              colors.accent
            )}
          />
        </div>
      </div>
    </motion.div>
  )
}

interface AdminVitalCardsProps {
  revenueData: {
    total: number
    trend: number
  }
  usersData: {
    total: number
    trend: number
  }
  activeExams: number
  expiringAccessCount: number
}

export function AdminVitalCards({
  revenueData,
  usersData,
  activeExams,
  expiringAccessCount,
}: AdminVitalCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
      <VitalCard
        label="Revenus (30j)"
        value={formatCurrency(revenueData.total)}
        trend={
          revenueData.trend !== 0
            ? { value: revenueData.trend, isPositive: revenueData.trend > 0 }
            : undefined
        }
        color="slate"
        delay={0}
        subtitle="vs 30 jours précédents"
      />

      <VitalCard
        label="Utilisateurs"
        value={usersData.total.toLocaleString("fr-CA")}
        trend={
          usersData.trend !== 0
            ? { value: usersData.trend, isPositive: usersData.trend > 0 }
            : undefined
        }
        color="emerald"
        delay={0.1}
        subtitle={`${usersData.trend >= 0 ? "+" : ""}${usersData.trend.toFixed(0)}% ce mois`}
      />

      <VitalCard
        label="Examens actifs"
        value={activeExams}
        color="amber"
        delay={0.2}
        subtitle="Examens en cours"
      />

      <VitalCard
        label="Accès expirant"
        value={expiringAccessCount}
        color="rose"
        delay={0.3}
        subtitle="Dans les 7 prochains jours"
        alert={expiringAccessCount > 0}
      />
    </div>
  )
}
