"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  IconAlertTriangle,
  IconClock,
  IconCreditCardOff,
  IconChevronRight,
  IconCircleCheck,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface ExpiringAccess {
  _id: string
  userId: string
  accessType: "exam" | "training"
  daysRemaining: number
  user: {
    name: string | null
    email: string | undefined
  } | null
}

interface AlertsPanelProps {
  expiringAccess: ExpiringAccess[]
  failedPaymentsCount: number
}

interface AlertItemProps {
  icon: React.ElementType
  iconColor: string
  bgColor: string
  title: string
  description: string
  count?: number
  href: string
}

function AlertItem({
  icon: Icon,
  iconColor,
  bgColor,
  title,
  description,
  count,
  href,
}: AlertItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-transparent p-3 transition-all duration-200",
        bgColor,
        "hover:border-gray-200 dark:hover:border-gray-700"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          iconColor
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </p>
          {count !== undefined && count > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white">
              {count}
            </span>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">{description}</p>
      </div>
      <IconChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function AlertsPanel({
  expiringAccess,
  failedPaymentsCount,
}: AlertsPanelProps) {
  const hasAlerts = expiringAccess.length > 0 || failedPaymentsCount > 0

  // Group expiring access by type
  const expiringExamAccess = expiringAccess.filter(
    (a) => a.accessType === "exam"
  )
  const expiringTrainingAccess = expiringAccess.filter(
    (a) => a.accessType === "training"
  )

  const getExpiringDescription = (items: ExpiringAccess[]) => {
    if (items.length === 0) return ""
    if (items.length === 1) {
      const item = items[0]
      return `${item.user?.name ?? "1 utilisateur"} - ${item.daysRemaining}j restant${item.daysRemaining > 1 ? "s" : ""}`
    }
    const minDays = Math.min(...items.map((i) => i.daysRemaining))
    return `${items.length} utilisateurs, ${minDays}j minimum`
  }

  if (!hasAlerts) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Alertes</CardTitle>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <IconCircleCheck className="h-5 w-5 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <IconCircleCheck className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="font-medium text-gray-900 dark:text-white">
              Tout va bien
            </p>
            <p className="text-muted-foreground text-sm">
              Aucune alerte à signaler
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Alertes</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
          <IconAlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {expiringExamAccess.length > 0 && (
          <AlertItem
            icon={IconClock}
            iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            bgColor="bg-amber-50/50 dark:bg-amber-900/10"
            title="Accès examens expirant"
            description={getExpiringDescription(expiringExamAccess)}
            count={expiringExamAccess.length}
            href="/admin/users"
          />
        )}

        {expiringTrainingAccess.length > 0 && (
          <AlertItem
            icon={IconClock}
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            bgColor="bg-orange-50/50 dark:bg-orange-900/10"
            title="Accès entraînement expirant"
            description={getExpiringDescription(expiringTrainingAccess)}
            count={expiringTrainingAccess.length}
            href="/admin/users"
          />
        )}

        {failedPaymentsCount > 0 && (
          <AlertItem
            icon={IconCreditCardOff}
            iconColor="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
            bgColor="bg-rose-50/50 dark:bg-rose-900/10"
            title="Paiements échoués"
            description={`${failedPaymentsCount} paiement${failedPaymentsCount > 1 ? "s" : ""} ces 7 derniers jours`}
            count={failedPaymentsCount}
            href="/admin/transactions?status=failed"
          />
        )}
      </CardContent>
    </Card>
  )
}
