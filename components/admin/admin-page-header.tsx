"use client"

import { type ReactNode, type ElementType } from "react"
import { motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const colorSchemes = {
  slate: {
    gradient: "from-slate-600 to-slate-700",
    shadow: "shadow-slate-500/20",
  },
  blue: {
    gradient: "from-blue-600 to-indigo-600",
    shadow: "shadow-blue-500/25",
  },
  violet: {
    gradient: "from-violet-600 to-purple-600",
    shadow: "shadow-violet-500/25",
  },
  amber: {
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/25",
  },
  emerald: {
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/25",
  },
} as const

type ColorScheme = keyof typeof colorSchemes

interface AdminPageHeaderProps {
  /** The icon component to display (Lucide or Tabler) */
  icon: ElementType
  /** Page title */
  title: string
  /** Page subtitle/description */
  subtitle: string
  /** Color scheme for the icon box gradient */
  colorScheme: ColorScheme
  /** Optional action buttons (rendered on the right side) */
  actions?: ReactNode
  /** Optional badge showing a count */
  badge?: {
    count: number | string
    label: string
  }
}

export function AdminPageHeader({
  icon: Icon,
  title,
  subtitle,
  colorScheme,
  actions,
  badge,
}: AdminPageHeaderProps) {
  const colors = colorSchemes[colorScheme]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-2"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Icon + Title */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
              "bg-gradient-to-br shadow-lg",
              colors.gradient,
              colors.shadow
            )}
          >
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right side: Badge + Actions */}
        {(badge || actions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {badge && (
              <Badge
                variant="secondary"
                className="h-8 shrink-0 bg-gray-100 px-3 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {badge.count} {badge.label}
              </Badge>
            )}
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  )
}
