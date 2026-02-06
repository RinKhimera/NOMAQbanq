"use client"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import {
  IconListDetails,
  IconPhoto,
  IconPhotoOff,
  IconCategory,
} from "@tabler/icons-react"

interface StatCardProps {
  label: string
  value: string | number
  color: "emerald" | "blue" | "slate" | "teal"
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
  slate: {
    bg: "from-slate-500/10 via-slate-400/5 to-transparent",
    iconBg: "bg-slate-500/10 dark:bg-slate-400/10",
    iconColor: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200/60 dark:border-slate-700/40",
    glow: "group-hover:shadow-slate-500/10",
    accent: "from-slate-500 to-slate-600",
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
          "relative h-full overflow-hidden rounded-2xl border bg-linear-to-br p-5 transition-all duration-300",
          "bg-white/90 backdrop-blur-sm dark:bg-gray-900/90",
          colors.border,
          colors.bg,
          "hover:-translate-y-0.5 hover:shadow-lg",
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
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-linear-to-br from-current to-transparent opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />

        {/* Header */}
        <div className="relative mb-3 flex items-center justify-between">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              colors.iconBg
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
            !subtitle && "invisible"
          )}
        >
          {subtitle || "placeholder"}
        </p>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 h-0.75 w-full overflow-hidden">
          <div
            className={cn(
              "h-full w-0 bg-linear-to-r transition-all duration-500 group-hover:w-full",
              colors.accent
            )}
          />
        </div>
      </div>
    </motion.div>
  )
}

interface QuestionsStatsRowProps {
  stats: {
    totalCount: number
    withImagesCount: number
    withoutImagesCount: number
    uniqueDomainsCount: number
  } | null
  isLoading?: boolean
}

export function QuestionsStatsRow({ stats, isLoading }: QuestionsStatsRowProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-39 animate-pulse rounded-2xl border border-gray-200/60 bg-gray-100/50 dark:border-gray-700/40 dark:bg-gray-800/50"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total questions"
        value={stats.totalCount.toLocaleString("fr-CA")}
        color="emerald"
        delay={0}
        subtitle="dans la banque"
        icon={<IconListDetails className="h-5 w-5" />}
      />

      <StatCard
        label="Avec images"
        value={stats.withImagesCount.toLocaleString("fr-CA")}
        color="blue"
        delay={0.05}
        subtitle={`${stats.totalCount > 0 ? Math.round((stats.withImagesCount / stats.totalCount) * 100) : 0}% du total`}
        icon={<IconPhoto className="h-5 w-5" />}
      />

      <StatCard
        label="Sans images"
        value={stats.withoutImagesCount.toLocaleString("fr-CA")}
        color="slate"
        delay={0.1}
        subtitle={`${stats.totalCount > 0 ? Math.round((stats.withoutImagesCount / stats.totalCount) * 100) : 0}% du total`}
        icon={<IconPhotoOff className="h-5 w-5" />}
      />

      <StatCard
        label="Domaines couverts"
        value={stats.uniqueDomainsCount}
        color="teal"
        delay={0.15}
        subtitle="spécialités médicales"
        icon={<IconCategory className="h-5 w-5" />}
      />
    </div>
  )
}
