"use client"

import { IconChevronRight, IconCreditCard } from "@tabler/icons-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { AccessCard } from "@/components/shared/payments/access-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

export const ProfileSubscriptionCard = ({
  accessStatus,
}: ProfileSubscriptionCardProps) => {
  const prefersReducedMotion = useReducedMotion()

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.5,
          delay: 0.25,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      }

  const hasAnyAccess = accessStatus?.examAccess || accessStatus?.trainingAccess

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
            <AccessCard
              type="exam"
              access={accessStatus?.examAccess ?? null}
              size="compact"
            />
            <AccessCard
              type="training"
              access={accessStatus?.trainingAccess ?? null}
              size="compact"
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
          <Button
            asChild
            variant="outline"
            className="mt-4 w-full justify-between rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Link href="/tableau-de-bord/abonnements">
              <span>Gérer mon abonnement</span>
              <IconChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
