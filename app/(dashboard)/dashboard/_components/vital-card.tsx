"use client"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import { LucideIcon } from "lucide-react"

interface VitalCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: "blue" | "green" | "amber" | "purple"
  delay?: number
  subtitle?: string
}

const colorVariants = {
  blue: {
    bg: "from-blue-500/10 to-blue-600/5",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    border: "border-blue-500/20 hover:border-blue-500/40",
    glow: "group-hover:shadow-blue-500/20",
  },
  green: {
    bg: "from-emerald-500/10 to-emerald-600/5",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    glow: "group-hover:shadow-emerald-500/20",
  },
  amber: {
    bg: "from-amber-500/10 to-amber-600/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    border: "border-amber-500/20 hover:border-amber-500/40",
    glow: "group-hover:shadow-amber-500/20",
  },
  purple: {
    bg: "from-purple-500/10 to-purple-600/5",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    border: "border-purple-500/20 hover:border-purple-500/40",
    glow: "group-hover:shadow-purple-500/20",
  },
}

export const VitalCard = ({
  label,
  value,
  icon: Icon,
  trend,
  color = "blue",
  delay = 0,
  subtitle,
}: VitalCardProps) => {
  const colors = colorVariants[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-linear-to-br p-5 transition-all duration-300",
          "bg-white/80 backdrop-blur-sm dark:bg-gray-900/80",
          colors.border,
          colors.bg,
          "hover:-translate-y-0.5 hover:shadow-lg",
          colors.glow
        )}
      >
        {/* Pulse animation on hover */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-linear-to-br from-current to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />

        {/* Header with icon */}
        <div className="mb-3 flex items-center justify-between">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              colors.iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", colors.iconColor)} aria-hidden="true" />
          </div>

          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                trend.isPositive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}
            >
              <svg
                className={cn(
                  "h-3 w-3",
                  !trend.isPositive && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              <span className="sr-only">{trend.isPositive ? "Hausse de" : "Baisse de"}</span>
              {trend.value}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <span className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {value}
          </span>
        </div>

        {/* Label */}
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {subtitle}
          </p>
        )}

        {/* Bottom decoration line */}
        <div className="absolute bottom-0 left-0 h-1 w-full">
          <div
            className={cn(
              "h-full w-0 transition-all duration-500 group-hover:w-full",
              color === "blue" && "bg-linear-to-r from-blue-500 to-blue-600",
              color === "green" && "bg-linear-to-r from-emerald-500 to-emerald-600",
              color === "amber" && "bg-linear-to-r from-amber-500 to-amber-600",
              color === "purple" && "bg-linear-to-r from-purple-500 to-purple-600"
            )}
          />
        </div>
      </div>
    </motion.div>
  )
}
