"use client"

import { useQuery } from "convex/react"
import { motion } from "motion/react"
import { Zap, Sparkles, Plus, Clock, Calendar } from "lucide-react"
import { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { formatExpiration } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { AccessBadge, getAccessStatus } from "@/components/shared/payments"

interface UserAccessSectionProps {
  userId: Id<"users">
  onAddAccess: () => void
}

const accessTypeConfig = {
  exam: {
    icon: Zap,
    label: "Examens Simulés",
    gradient: "from-blue-600 to-indigo-600",
    lightGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
  },
  training: {
    icon: Sparkles,
    label: "Banque d'Entraînement",
    gradient: "from-emerald-600 to-teal-600",
    lightGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
  },
}

const AccessCard = ({
  type,
  access,
}: {
  type: "exam" | "training"
  access: { expiresAt: number; daysRemaining: number } | null
}) => {
  const config = accessTypeConfig[type]
  const Icon = config.icon
  const status = getAccessStatus(access?.expiresAt, access?.daysRemaining)
  const isActive = status === "active" || status === "expiring"
  const progressPercent = access ? Math.min((access.daysRemaining / 180) * 100, 100) : 0

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        isActive
          ? "border-transparent bg-white shadow-md dark:bg-gray-900"
          : "border-dashed border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30"
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              isActive
                ? cn("bg-gradient-to-br", config.gradient)
                : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                isActive ? "text-white" : "text-gray-400"
              )}
            />
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {config.label}
          </span>
        </div>
        <AccessBadge
          accessType={type}
          status={status}
          daysRemaining={access?.daysRemaining}
          size="sm"
        />
      </div>

      {/* Details for active access */}
      {isActive && access && (
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
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3.5 w-3.5" />
            Expire le {formatExpiration(access.expiresAt)}
          </div>
        </div>
      )}

      {/* Inactive state */}
      {!isActive && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucun accès actif
        </p>
      )}
    </div>
  )
}

export const UserAccessSection = ({ userId, onAddAccess }: UserAccessSectionProps) => {
  const accessStatus = useQuery(api.payments.getUserAccessStatus, { userId })

  if (accessStatus === undefined) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <Clock className="h-5 w-5 text-slate-600" />
          Statut des accès
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddAccess}
          className="rounded-xl"
        >
          <Plus className="mr-1 h-4 w-4" />
          Ajouter accès
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AccessCard type="exam" access={accessStatus?.examAccess ?? null} />
        <AccessCard type="training" access={accessStatus?.trainingAccess ?? null} />
      </div>
    </motion.div>
  )
}
