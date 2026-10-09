import {
  CircleCheck,
  CreditCard,
  Inbox,
  type LucideIcon,
  UserPlus,
} from "lucide-react"
import { RelativeTime } from "@/components/shared/relative-time"
import { EmptyState } from "@/components/ui/empty-state"
import type { AdminActivity } from "@/features/analytics/dal"
import { formatCurrency } from "@/lib/format"
import { formatScore, scoreTextClass } from "@/lib/score"
import { DashboardPanel } from "./dashboard-panel"

const ICON: Record<AdminActivity["type"], LucideIcon> = {
  user_signup: UserPlus,
  payment: CreditCard,
  exam_submitted: CircleCheck,
}

const Line = ({ activity }: { activity: AdminActivity }) => {
  switch (activity.type) {
    case "user_signup":
      return (
        <>
          <span className="text-ink text-sm font-medium">
            Nouvelle inscription
          </span>
          <span className="text-ink-3 text-[0.8125rem] wrap-anywhere">
            {activity.data.userName}
            {activity.data.userEmail ? ` · ${activity.data.userEmail}` : ""}
          </span>
        </>
      )
    case "payment":
      return (
        <>
          <span className="text-ink text-sm font-medium">
            Paiement reçu
            {activity.data.paymentType === "manual" && (
              <span className="text-ink-3 font-normal"> · Manuel</span>
            )}
          </span>
          <span className="text-ink-3 text-[0.8125rem]">
            {activity.data.userName} a payé{" "}
            <span className="text-ink font-mono">
              {formatCurrency(activity.data.amount, activity.data.currency, {
                whole: true,
              })}
            </span>{" "}
            pour {activity.data.productName}
          </span>
        </>
      )
    case "exam_submitted":
      return (
        <>
          <span className="text-ink text-sm font-medium">
            {activity.data.status === "auto_submitted"
              ? "Examen soumis automatiquement"
              : "Examen soumis"}
          </span>
          <span className="text-ink-3 text-[0.8125rem]">
            {activity.data.userName} · {activity.data.examTitle}
            {activity.data.score !== null && (
              <>
                {" · "}
                <span
                  className={`font-mono ${scoreTextClass(activity.data.score)}`}
                >
                  {formatScore(activity.data.score)}
                </span>
              </>
            )}
          </span>
        </>
      )
  }
}

/** Dernières actions sur la plateforme : inscriptions, paiements, examens. */
export function ActivityFeed({ activities }: { activities: AdminActivity[] }) {
  return (
    <DashboardPanel eyebrow="Activité" title="Dernières actions">
      {activities.length === 0 ? (
        <EmptyState
          size="compact"
          icons={[Inbox]}
          title="Aucune activité récente"
        />
      ) : (
        <ol>
          {activities.map((activity, i) => {
            const Icon = ICON[activity.type]
            return (
              <li
                key={`${activity.type}-${i}`}
                className="border-line grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-3 border-t py-2.5 first:border-t-0"
              >
                <Icon aria-hidden="true" className="text-ink-3 mt-0.5 size-4" />
                <span className="flex min-w-0 flex-col">
                  <Line activity={activity} />
                </span>
                <span className="text-ink-3 text-xs whitespace-nowrap">
                  <RelativeTime timestamp={activity.timestamp} />
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </DashboardPanel>
  )
}
