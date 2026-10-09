import {
  Banknote,
  FilePlus2,
  KeyRound,
  type LucideIcon,
  UserCheck,
  UserX,
} from "lucide-react"
import Link from "next/link"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { clientFileHref } from "@/components/shared/payments/transaction-labels"
import { RelativeTime } from "@/components/shared/relative-time"
import { StatBand, type StatBandItem } from "@/components/shared/stat-band"
import type {
  AdminActivity,
  AdminActivityItem,
} from "@/features/users/dal.activity"
import { formatCurrency, formatMediumDate } from "@/lib/format"

const plural = (n: number, one: string, many: string) =>
  `${n} ${n > 1 ? many : one}`

const statItems = (a: AdminActivity): StatBandItem[] => {
  const amounts = a.manualPayments.totals.map((t) =>
    formatCurrency(t.amount, t.currency),
  )
  const last = a.manualPayments.lastAt
    ? `dernier le ${formatMediumDate(a.manualPayments.lastAt)}`
    : null
  const paymentsSub = [...amounts, ...(last ? [last] : [])].join(" · ")
  return [
    {
      label: "Paiements manuels",
      value: a.manualPayments.count,
      sub: paymentsSub || null,
    },
    {
      label: "Examens créés",
      value: a.exams.count,
      sub: a.exams.openOrUpcoming
        ? `dont ${a.exams.openOrUpcoming} ${a.exams.openOrUpcoming > 1 ? "ouverts" : "ouvert"} ou à venir`
        : null,
    },
    { label: "Clés confirmées", value: a.confirmedKeys },
    {
      label: "Suspensions",
      value: a.suspensions.pronounced,
      sub:
        a.suspensions.pronounced || a.suspensions.lifted
          ? `${plural(a.suspensions.active, "active", "actives")} · ${plural(a.suspensions.lifted, "levée", "levées")}`
          : null,
    },
  ]
}

const FEED_KIND: Record<
  AdminActivityItem["kind"],
  { icon: LucideIcon; verb: string; href: (item: AdminActivityItem) => string }
> = {
  manual_payment: {
    icon: Banknote,
    verb: "Paiement manuel enregistré",
    href: (item) => clientFileHref(item.clientId ?? "", item.id),
  },
  exam_created: {
    icon: FilePlus2,
    verb: "Examen créé",
    href: (item) => `/admin/examens/${item.id}`,
  },
  key_confirmed: {
    icon: KeyRound,
    verb: "Clé confirmée",
    href: (item) => `/admin/questions/${item.id}`,
  },
  suspension: {
    icon: UserX,
    verb: "Compte suspendu",
    href: (item) => `/admin/utilisateurs/${item.id}`,
  },
  suspension_lifted: {
    icon: UserCheck,
    verb: "Suspension levée",
    href: (item) => `/admin/utilisateurs/${item.id}`,
  },
}

/** « Mon activité » : ce que l'administrateur connecté a fait lui-même. */
export const ProfileAdminActivity = ({
  activity,
}: {
  activity: AdminActivity
}) => (
  <div className="flex flex-col gap-5">
    <StatBand items={statItems(activity)} />
    <div className="flex flex-col gap-2">
      <h3 className="type-label">Mes dernières actions</h3>
      {activity.feed.length === 0 ? (
        <p className="text-ink-3 border-line border-t py-3.5 text-sm">
          Vos actions d&apos;administration apparaîtront ici.
        </p>
      ) : (
        <ul className="border-line border-t">
          {activity.feed.map((item) => {
            const kind = FEED_KIND[item.kind]
            const Icon = kind.icon
            return (
              <li
                key={`${item.kind}:${item.id}:${item.at.getTime()}`}
                className="border-line border-b"
              >
                {/* Dix liens vers des pages admin dynamiques : sans prefetch
                    (`.claude/rules/loading-ui.md`). */}
                <Link
                  href={kind.href(item)}
                  prefetch={false}
                  className="hover:bg-surface-2 -mx-2 grid min-h-11 grid-cols-[1.125rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-3 max-[480px]:grid-cols-[1.125rem_minmax(0,1fr)] max-[480px]:items-start"
                >
                  <Icon aria-hidden className="text-ink-3 size-4" />
                  <span className="text-ink min-w-0 text-[0.9375rem] wrap-anywhere">
                    {kind.verb} —{" "}
                    <span className="text-ink-2">{item.label}</span>
                  </span>
                  <span className="text-ink-3 flex items-center gap-2 font-mono text-xs whitespace-nowrap max-[480px]:col-start-2">
                    <LinkPendingIndicator />
                    <RelativeTime timestamp={item.at.getTime()} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  </div>
)
