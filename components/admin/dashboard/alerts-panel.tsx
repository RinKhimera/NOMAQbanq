import { ChevronRight, CircleAlert, CircleCheck, Clock } from "lucide-react"
import Link from "next/link"
import type { ExpiringAccessItem } from "@/features/payments/dal"
import { TONE_TEXT } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { DashboardPanel } from "./dashboard-panel"

type ExpiringAccess = Pick<
  ExpiringAccessItem,
  "id" | "accessType" | "daysRemaining"
> & { user: { name: string | null } | null }

const describeExpiring = (items: ExpiringAccess[]) => {
  if (items.length === 1) {
    const [item] = items
    return `${item.user?.name ?? "1 utilisateur"} - ${item.daysRemaining}j restant${item.daysRemaining > 1 ? "s" : ""}`
  }
  const minDays = Math.min(...items.map((i) => i.daysRemaining))
  return `${items.length} utilisateurs, ${minDays}j minimum`
}

const AlertRow = ({
  tone,
  icon: Icon,
  title,
  description,
  count,
  href,
}: {
  tone: "warning" | "danger"
  icon: typeof Clock
  title: string
  description: string
  count: number
  href: string
}) => (
  <Link
    href={href}
    prefetch={false}
    className="focus-ring group border-line grid min-h-11 grid-cols-[18px_minmax(0,1fr)_auto_16px] items-center gap-3 border-t py-3 first:border-t-0"
  >
    <Icon aria-hidden="true" className={cn("size-4", TONE_TEXT[tone])} />
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-ink text-sm font-medium group-hover:underline group-hover:underline-offset-3">
        {title}
      </span>
      <span className="text-ink-3 truncate text-[0.8125rem]">
        {description}
      </span>
    </span>
    <span className="text-ink font-mono text-sm tabular-nums">{count}</span>
    <ChevronRight aria-hidden="true" className="text-ink-3 size-4" />
  </Link>
)

/** Alertes : accès qui expirent sous 7 jours, paiements échoués. */
export function AlertsPanel({
  expiringAccess,
  failedPaymentsCount,
}: {
  expiringAccess: ExpiringAccess[]
  failedPaymentsCount: number
}) {
  const exam = expiringAccess.filter((a) => a.accessType === "exam")
  const training = expiringAccess.filter((a) => a.accessType === "training")
  const none = expiringAccess.length === 0 && failedPaymentsCount === 0

  return (
    <DashboardPanel eyebrow="Suivi" title="Alertes">
      {none ? (
        <div className="flex items-center gap-2.5 text-sm">
          <CircleCheck aria-hidden="true" className="text-success size-4" />
          <span>
            <span className="text-ink font-medium">Tout va bien</span>
            <span className="text-ink-3"> · Aucune alerte à signaler</span>
          </span>
        </div>
      ) : (
        <div className="flex flex-col">
          {exam.length > 0 && (
            <AlertRow
              tone="warning"
              icon={Clock}
              title="Accès examens expirant"
              description={describeExpiring(exam)}
              count={exam.length}
              href="/admin/utilisateurs?segment=bientot"
            />
          )}
          {training.length > 0 && (
            <AlertRow
              tone="warning"
              icon={Clock}
              title="Accès entraînement expirant"
              description={describeExpiring(training)}
              count={training.length}
              href="/admin/utilisateurs?segment=bientot"
            />
          )}
          {failedPaymentsCount > 0 && (
            <AlertRow
              tone="danger"
              icon={CircleAlert}
              title="Paiements échoués"
              description={`${failedPaymentsCount} paiement${failedPaymentsCount > 1 ? "s" : ""} ces 7 derniers jours`}
              count={failedPaymentsCount}
              href="/admin/transactions?filtre=echec"
            />
          )}
        </div>
      )}
    </DashboardPanel>
  )
}
