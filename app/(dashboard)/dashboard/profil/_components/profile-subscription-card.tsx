"use client"

import { IconChevronRight, IconCreditCard } from "@tabler/icons-react"
import { Sparkles, Zap } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type AccessInfo = {
  expiresAt: number
  daysRemaining: number
} | null

type ProfileSubscriptionCardProps = {
  accessStatus: {
    examAccess: AccessInfo
    trainingAccess: AccessInfo
  } | null
}

const AccessMiniCard = ({
  type,
  access,
}: {
  type: "exam" | "training"
  access: AccessInfo
}) => {
  const config = {
    exam: {
      icon: Zap,
      label: "Examens",
      gradient: "from-blue-500 to-indigo-600",
      lightBg: "bg-blue-50 dark:bg-blue-950/30",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    training: {
      icon: Sparkles,
      label: "Entraînement",
      gradient: "from-emerald-500 to-teal-600",
      lightBg: "bg-emerald-50 dark:bg-emerald-950/30",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
  }

  const { icon: Icon, label, gradient, lightBg, textColor } = config[type]
  const isActive = access && access.daysRemaining > 0
  const progressPercent = access
    ? Math.min((access.daysRemaining / 180) * 100, 100)
    : 0

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-4 transition-all duration-200",
        isActive ? lightBg : "bg-gray-50 dark:bg-gray-800/50",
      )}
    >
      {/* Active indicator line */}
      {isActive && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-linear-to-r",
            gradient,
          )}
        />
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            isActive
              ? cn("bg-linear-to-br shadow-md", gradient)
              : "bg-gray-200 dark:bg-gray-700",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              isActive ? "text-white" : "text-gray-400 dark:text-gray-500",
            )}
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </p>
          {isActive ? (
            <p className={cn("text-xs font-medium", textColor)}>
              {access.daysRemaining} jours restants
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Non actif
            </p>
          )}
        </div>
      </div>

      {/* Progress bar for active */}
      {isActive && (
        <div className="mt-3">
          <Progress
            value={progressPercent}
            className="h-1.5"
            aria-label={`${access.daysRemaining} jours restants`}
          />
        </div>
      )}
    </div>
  )
}

export const ProfileSubscriptionCard = ({
  accessStatus,
}: ProfileSubscriptionCardProps) => {
  const prefersReducedMotion = useReducedMotion()

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] as const },
      }

  const hasAnyAccess =
    accessStatus?.examAccess || accessStatus?.trainingAccess

  return (
    <motion.div {...motionProps}>
      <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
        <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <IconCreditCard className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-semibold text-gray-900 dark:text-white">
              Abonnement
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          {/* Access cards grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <AccessMiniCard
              type="exam"
              access={accessStatus?.examAccess ?? null}
            />
            <AccessMiniCard
              type="training"
              access={accessStatus?.trainingAccess ?? null}
            />
          </div>

          {/* Upgrade prompt if no access */}
          {!hasAnyAccess && (
            <div className="mt-4 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 p-4 dark:from-blue-950/30 dark:to-indigo-950/30">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Débloquez l{"'"}accès aux examens et à la banque d{"'"}
                entraînement pour préparer votre EACMC.
              </p>
            </div>
          )}

          {/* Link to subscription page */}
          <Link href="/dashboard/abonnements" className="mt-4 block">
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <span>Gérer mon abonnement</span>
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}
