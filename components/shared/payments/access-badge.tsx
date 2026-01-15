"use client"

import { CheckCircle, Clock, XCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatExpiration } from "@/lib/format"

type AccessStatus = "active" | "expiring" | "expired" | "none"

interface AccessBadgeProps {
  accessType: "exam" | "training"
  status: AccessStatus
  expiresAt?: number
  daysRemaining?: number
  size?: "sm" | "md" | "lg"
  showDetails?: boolean
  className?: string
}

const statusConfig = {
  active: {
    icon: CheckCircle,
    label: "Actif",
    bgClass: "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20",
    borderClass: "border-emerald-500/30 dark:border-emerald-400/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    iconClass: "text-emerald-500 dark:text-emerald-400",
    glowClass: "shadow-emerald-500/20",
  },
  expiring: {
    icon: Clock,
    label: "Expire bientôt",
    bgClass: "bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20",
    borderClass: "border-amber-500/30 dark:border-amber-400/30",
    textClass: "text-amber-700 dark:text-amber-300",
    iconClass: "text-amber-500 dark:text-amber-400 animate-pulse",
    glowClass: "shadow-amber-500/20",
  },
  expired: {
    icon: XCircle,
    label: "Expiré",
    bgClass: "bg-gradient-to-r from-red-500/10 to-rose-500/10 dark:from-red-500/20 dark:to-rose-500/20",
    borderClass: "border-red-500/30 dark:border-red-400/30",
    textClass: "text-red-700 dark:text-red-300",
    iconClass: "text-red-500 dark:text-red-400",
    glowClass: "shadow-red-500/20",
  },
  none: {
    icon: Sparkles,
    label: "Aucun accès",
    bgClass: "bg-gradient-to-r from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20",
    borderClass: "border-slate-500/30 dark:border-slate-400/30",
    textClass: "text-slate-600 dark:text-slate-400",
    iconClass: "text-slate-400 dark:text-slate-500",
    glowClass: "",
  },
}

const sizeConfig = {
  sm: {
    padding: "px-2.5 py-1",
    iconSize: "h-3.5 w-3.5",
    textSize: "text-xs",
    gap: "gap-1.5",
  },
  md: {
    padding: "px-3.5 py-1.5",
    iconSize: "h-4 w-4",
    textSize: "text-sm",
    gap: "gap-2",
  },
  lg: {
    padding: "px-4 py-2",
    iconSize: "h-5 w-5",
    textSize: "text-base",
    gap: "gap-2.5",
  },
}

const accessTypeLabels = {
  exam: "Examens",
  training: "Entraînement",
}

export const AccessBadge = ({
  accessType,
  status,
  expiresAt,
  daysRemaining,
  size = "md",
  showDetails = false,
  className,
}: AccessBadgeProps) => {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]
  const Icon = config.icon

  const getStatusLabel = () => {
    if (status === "none") return config.label
    if (status === "expired") return config.label
    if (status === "expiring" && daysRemaining !== undefined) {
      return `${daysRemaining}j restants`
    }
    if (status === "active" && daysRemaining !== undefined) {
      return `${daysRemaining}j restants`
    }
    return config.label
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-all duration-300",
        config.bgClass,
        config.borderClass,
        config.textClass,
        sizes.padding,
        sizes.gap,
        status === "active" && "shadow-lg",
        config.glowClass,
        className
      )}
    >
      <Icon className={cn(sizes.iconSize, config.iconClass)} />
      <span className={sizes.textSize}>
        {showDetails ? `${accessTypeLabels[accessType]} · ${getStatusLabel()}` : getStatusLabel()}
      </span>
      {showDetails && expiresAt && status !== "none" && status !== "expired" && (
        <span className={cn(sizes.textSize, "opacity-70")}>
          · {formatExpiration(expiresAt)}
        </span>
      )}
    </div>
  )
}

export const getAccessStatus = (
  expiresAt: number | null | undefined,
  daysRemaining: number | null | undefined
): AccessStatus => {
  if (!expiresAt) return "none"
  if (Date.now() > expiresAt) return "expired"
  if (daysRemaining !== undefined && daysRemaining !== null && daysRemaining <= 7) return "expiring"
  return "active"
}
