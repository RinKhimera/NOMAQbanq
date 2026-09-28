"use client"

import { Calendar, Sparkles, Zap } from "lucide-react"
import type { ReactNode } from "react"
import { Progress } from "@/components/ui/progress"
import { formatExpiration } from "@/lib/format"
import { cn } from "@/lib/utils"
import { AccessBadge, getAccessStatus } from "./access-badge"

// Échelle de la barre : la durée du plus long produit. Un cumul qui la
// dépasse remplit la barre sans la déborder.
const PROGRESS_SPAN_DAYS = 180

const accessTypeConfig = {
  exam: {
    icon: Zap,
    label: "Examens Simulés",
    description: "Accès aux examens blancs chronométrés",
    gradient: "from-blue-600 to-indigo-600",
  },
  training: {
    icon: Sparkles,
    label: "Banque d'Entraînement",
    description: "Accès à 5000+ questions d'entraînement",
    gradient: "from-emerald-600 to-teal-600",
  },
}

type AccessCardProps = {
  type: "exam" | "training"
  access: { expiresAt: number; daysRemaining: number } | null
  size?: "compact" | "default"
  action?: (active: boolean) => ReactNode
}

export const AccessCard = ({
  type,
  access,
  size = "default",
  action,
}: AccessCardProps) => {
  const config = accessTypeConfig[type]
  const Icon = config.icon
  const status = getAccessStatus(access?.expiresAt, access?.daysRemaining)
  const isActive = status === "active" || status === "expiring"
  const compact = size === "compact"
  const progressPercent = access
    ? Math.min((access.daysRemaining / PROGRESS_SPAN_DAYS) * 100, 100)
    : 0

  return (
    <div
      className={cn(
        "relative overflow-hidden border transition-all",
        compact ? "rounded-xl p-4" : "rounded-2xl border-2 p-6",
        isActive
          ? cn(
              "border-transparent bg-white dark:bg-gray-900",
              compact ? "shadow-md" : "shadow-xl",
            )
          : "border-dashed border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30",
      )}
    >
      {isActive && !compact && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-linear-to-r",
            config.gradient,
          )}
        />
      )}

      <div
        className={cn(
          "flex justify-between",
          compact ? "mb-3 items-center" : "mb-4 items-start",
        )}
      >
        <div className={cn("flex items-center", compact ? "gap-2" : "gap-3")}>
          <div
            className={cn(
              "flex items-center justify-center",
              compact ? "h-8 w-8 rounded-lg" : "h-12 w-12 rounded-xl",
              isActive
                ? cn("bg-linear-to-br", config.gradient)
                : "bg-gray-200 dark:bg-gray-700",
            )}
          >
            <Icon
              className={cn(
                compact ? "h-4 w-4" : "h-6 w-6",
                isActive ? "text-white" : "text-gray-400 dark:text-gray-500",
              )}
            />
          </div>
          <div>
            <p
              className={cn(
                "text-gray-900 dark:text-white",
                compact ? "font-medium" : "font-semibold",
              )}
            >
              {config.label}
            </p>
            {!compact && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {config.description}
              </p>
            )}
          </div>
        </div>
        <AccessBadge
          accessType={type}
          status={status}
          daysRemaining={access?.daysRemaining}
          size="sm"
        />
      </div>

      {isActive && access ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Temps restant</span>
              <span>{access.daysRemaining} jours</span>
            </div>
            <Progress
              value={progressPercent}
              className="h-1.5"
              aria-label={`${access.daysRemaining} jours restants`}
            />
          </div>
          <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3.5 w-3.5" />
            Expire le {formatExpiration(access.expiresAt)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucun accès actif
        </p>
      )}

      {action && <div className="mt-4">{action(isActive)}</div>}
    </div>
  )
}
