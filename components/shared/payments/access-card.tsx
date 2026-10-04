import { BookOpen, Calendar, ClipboardList } from "lucide-react"
import type { ReactNode } from "react"
import { Progress } from "@/components/ui/progress"
import { formatExpiration } from "@/lib/format"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { AccessBadge, getAccessStatus } from "./access-badge"

// Échelle de la barre : la durée du plus long produit. Un cumul qui la
// dépasse remplit la barre sans la déborder.
const PROGRESS_SPAN_DAYS = 180

const accessTypeConfig = {
  exam: {
    icon: ClipboardList,
    label: "Examens simulés",
    description: "Examens blancs chronométrés, correction détaillée",
    // Entraînement en émeraude (DESIGN.md §1) ; les examens gardent l'accent.
    barColor: TONE_COLOR.info,
  },
  training: {
    icon: BookOpen,
    label: "Banque d'entraînement",
    description: "Questions par domaine, mode tuteur",
    barColor: TONE_COLOR.success,
  },
}

type AccessCardProps = {
  type: "exam" | "training"
  access: { expiresAt: number; daysRemaining: number } | null
  size?: "compact" | "default"
  /** Sous la carte : « Prolonger », « Activer »… selon que l'accès est actif. */
  action?: (active: boolean) => ReactNode
  /** Remplace « Aucun accès actif » (date d'expiration passée, prix d'appel). */
  inactiveNote?: ReactNode
}

export const AccessCard = ({
  type,
  access,
  size = "default",
  action,
  inactiveNote,
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
        "border-line flex flex-col rounded-lg border",
        compact ? "gap-3 p-4" : "gap-4.5 p-6 max-md:p-5",
        isActive ? "bg-surface shadow-1" : "border-dashed",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="text-ink-3 mt-0.5 size-4.5" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-ink font-semibold">{config.label}</h3>
            {!compact && (
              <p className="text-ink-3 text-[0.8125rem]">
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
        <>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-2">Temps restant</span>
              <span className="text-ink font-mono">
                {access.daysRemaining} jours
              </span>
            </div>
            <Progress
              value={progressPercent}
              indicatorColor={
                status === "expiring" ? TONE_COLOR.warning : config.barColor
              }
              className="h-1.5"
              aria-label={`${access.daysRemaining} jours restants`}
            />
          </div>
          <div className="bg-surface-2 border-line flex items-center justify-between gap-3 rounded-md border px-3.5 py-3 text-sm">
            <span className="text-ink-2 flex items-center gap-2">
              <Calendar className="text-ink-3 size-4" aria-hidden="true" />
              Expire le
            </span>
            <span className="text-ink font-medium">
              {formatExpiration(access.expiresAt)}
            </span>
          </div>
        </>
      ) : (
        <p className="text-ink-2 text-sm leading-relaxed">
          {inactiveNote ?? "Aucun accès actif"}
        </p>
      )}

      {action?.(isActive)}
    </div>
  )
}
