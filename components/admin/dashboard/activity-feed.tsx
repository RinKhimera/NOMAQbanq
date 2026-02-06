"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  IconUserPlus,
  IconCreditCard,
  IconChecks,
  IconActivity,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

type Activity =
  | {
      type: "user_signup"
      timestamp: number
      data: {
        userName: string
        userEmail: string | undefined
      }
    }
  | {
      type: "payment"
      timestamp: number
      data: {
        userName: string
        amount: number
        currency: string
        productName: string
        paymentType: "stripe" | "manual"
      }
    }
  | {
      type: "exam_completed"
      timestamp: number
      data: {
        userName: string
        examTitle: string
        score: number | null
      }
    }

interface ActivityFeedProps {
  activities: Activity[]
}

const activityConfig = {
  user_signup: {
    icon: IconUserPlus,
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Nouvelle inscription",
  },
  payment: {
    icon: IconCreditCard,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Paiement reçu",
  },
  exam_completed: {
    icon: IconChecks,
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Examen complété",
  },
}

function formatTimestamp(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: fr,
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

function ActivityItem({ activity }: { activity: Activity }) {
  const config = activityConfig[activity.type]
  const Icon = config.icon

  const renderContent = () => {
    switch (activity.type) {
      case "user_signup":
        return (
          <>
            <span className="font-medium text-gray-900 dark:text-white">
              {activity.data.userName}
            </span>
            <span className="text-muted-foreground"> s&apos;est inscrit</span>
            {activity.data.userEmail && (
              <span className="text-muted-foreground text-xs">
                {" "}
                ({activity.data.userEmail})
              </span>
            )}
          </>
        )
      case "payment":
        return (
          <>
            <span className="font-medium text-gray-900 dark:text-white">
              {activity.data.userName}
            </span>
            <span className="text-muted-foreground"> a payé </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(activity.data.amount)}
            </span>
            <span className="text-muted-foreground">
              {" "}
              pour {activity.data.productName}
            </span>
            {activity.data.paymentType === "manual" && (
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Manuel
              </span>
            )}
          </>
        )
      case "exam_completed":
        return (
          <>
            <span className="font-medium text-gray-900 dark:text-white">
              {activity.data.userName}
            </span>
            <span className="text-muted-foreground"> a terminé </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {activity.data.examTitle}
            </span>
            {activity.data.score !== null && (
              <span
                className={cn(
                  "ml-1 font-semibold",
                  activity.data.score >= 70
                    ? "text-emerald-600 dark:text-emerald-400"
                    : activity.data.score >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                )}
              >
                ({activity.data.score}%)
              </span>
            )}
          </>
        )
    }
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105",
          config.color
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm leading-tight">{renderContent()}</p>
        <p className="text-muted-foreground text-xs">
          {formatTimestamp(activity.timestamp)}
        </p>
      </div>
    </div>
  )
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">
            Activité récente
          </CardTitle>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <IconActivity className="h-5 w-5 text-slate-500" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-2 text-4xl">📋</div>
            <p className="text-muted-foreground text-sm">
              Aucune activité récente
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">
          Activité récente
        </CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <IconActivity className="h-5 w-5 text-slate-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-80 px-4 pb-4">
          <div className="space-y-1">
            {activities.map((activity, index) => (
              <ActivityItem key={`${activity.type}-${index}`} activity={activity} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
