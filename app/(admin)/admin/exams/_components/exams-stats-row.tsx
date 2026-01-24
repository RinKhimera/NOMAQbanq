"use client"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import {
  IconClipboardCheck,
  IconClipboardList,
  IconCalendarEvent,
  IconUsers,
} from "@tabler/icons-react"

interface StatCardProps {
  label: string
  value: string | number
  color: "emerald" | "blue" | "amber" | "teal"
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
}

function StatCard({
  label,
  value,
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
          "relative h-full overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300",
          "bg-white/90 backdrop-blur-sm dark:bg-gray-900/90",
          colors.border,
          colors.bg,
          "hover:translate-y-[-2px] hover:shadow-lg",
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
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-current to-transparent opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />

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
        <p
          className={cn(
            "mt-1 text-xs text-gray-500 dark:text-gray-500",
            !subtitle && "invisible",
          )}
        >
          {subtitle || "placeholder"}
        </p>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 h-[3px] w-full overflow-hidden">
          <div
            className={cn(
              "h-full w-0 bg-gradient-to-r transition-all duration-500 group-hover:w-full",
              colors.accent,
            )}
          />
        </div>
      </div>
    </motion.div>
  )
}

interface ExamsStatsRowProps {
  stats: {
    total: number
    active: number
    upcoming: number
    eligibleCandidates: number
  } | null
  isLoading?: boolean
}

export function ExamsStatsRow({ stats, isLoading }: ExamsStatsRowProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[156px] animate-pulse rounded-2xl border border-gray-200/60 bg-gray-100/50 dark:border-gray-700/40 dark:bg-gray-800/50"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total examens"
        value={stats.total}
        color="emerald"
        delay={0}
        icon={<IconClipboardList className="h-5 w-5" />}
      />

      <StatCard
        label="Examens actifs"
        value={stats.active}
        color="blue"
        delay={0.05}
        subtitle="En cours actuellement"
        icon={<IconClipboardCheck className="h-5 w-5" />}
      />

      <StatCard
        label="À venir"
        value={stats.upcoming}
        color="amber"
        delay={0.1}
        subtitle="Planifiés prochainement"
        icon={<IconCalendarEvent className="h-5 w-5" />}
      />

      <StatCard
        label="Candidats éligibles"
        value={stats.eligibleCandidates}
        color="teal"
        delay={0.15}
        subtitle="Avec accès exam actif"
        icon={<IconUsers className="h-5 w-5" />}
      />
    </div>
  )
}
