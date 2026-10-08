import type { AccessType } from "@/features/payments/access-ledger"
import { TONE_COLOR, TONE_SOFT, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

type AccessStatus = "active" | "expiring" | "expired" | "none"

interface AccessBadgeProps {
  accessType: AccessType
  status: AccessStatus
  daysRemaining?: number
  size?: "sm" | "md" | "lg"
  showDetails?: boolean
  className?: string
}

const STATUS: Record<AccessStatus, { tone: Tone; label: string }> = {
  active: { tone: "success", label: "Actif" },
  expiring: { tone: "warning", label: "Expire bientôt" },
  expired: { tone: "danger", label: "Expiré" },
  none: { tone: "neutral", label: "Aucun accès" },
}

const SIZE = {
  sm: "h-6 px-2 text-xs",
  md: "h-7 px-2.5 text-sm",
  lg: "h-8 px-3 text-sm",
}

/** Nom court d'un accès, tel qu'il s'écrit dans une phrase (« accès Examens »). */
export const ACCESS_TYPE_LABEL: Record<AccessType, string> = {
  exam: "Examens",
  training: "Entraînement",
}

/** Statut d'un accès : pastille à point coloré, jours restants en mono. */
export const AccessBadge = ({
  accessType,
  status,
  daysRemaining,
  size = "md",
  showDetails = false,
  className,
}: AccessBadgeProps) => {
  const { tone, label } = STATUS[status]
  const statusLabel =
    (status === "active" || status === "expiring") &&
    daysRemaining !== undefined
      ? `${daysRemaining}j restants`
      : label

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-xs border font-medium whitespace-nowrap",
        TONE_SOFT[tone],
        SIZE[size],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: TONE_COLOR[tone] }}
      />
      {showDetails && (
        <span className="text-ink font-semibold">
          {ACCESS_TYPE_LABEL[accessType]}
        </span>
      )}
      <span className="font-mono text-[0.92em]">{statusLabel}</span>
    </span>
  )
}

/** Jours entiers restants avant `expiresAt`, arrondis au jour supérieur. */
export const daysUntil = (expiresAt: number, now: number): number =>
  Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))

/**
 * Statut dérivé de `daysRemaining` seul, jamais de l'horloge : ce helper est
 * appelé dans le corps de rendu de composants rendus d'abord côté serveur, où
 * un `Date.now()` diverge entre le SSR et l'hydratation et fait basculer le
 * badge `active` → `expired` entre les deux arbres.
 *
 * L'invariant qui rend l'horloge inutile est tenu par les DAL : un accès expiré
 * en sort soit à `null` (`AccessInfo`), soit avec `daysRemaining` ramené à 0
 * (`PanelAccess`, qui conserve les accès échus pour l'admin).
 */
export const getAccessStatus = (
  expiresAt: number | null | undefined,
  daysRemaining: number | null | undefined,
): AccessStatus => {
  if (!expiresAt) return "none"
  if (daysRemaining === undefined || daysRemaining === null) return "active"
  if (daysRemaining <= 0) return "expired"
  if (daysRemaining <= 7) return "expiring"
  return "active"
}
