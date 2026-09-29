import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { TONE_TEXT } from "@/lib/tone"
import { cn } from "@/lib/utils"

type VitalCardProps = {
  label: string
  /** Valeur déjà formatée ; « — » quand la donnée manque, jamais un 0 fabriqué. */
  value: string
  /** Unité accolée en petit (« % »), omise quand la valeur vaut « — ». */
  unit?: string
  icon?: LucideIcon
  subtitle?: ReactNode
  /** Écart en points avec la période précédente ; absent = pas de comparaison. */
  trend?: number | null
}

const Trend = ({ points }: { points: number }) => {
  const Arrow = points < 0 ? ArrowDownRight : ArrowUpRight
  const tone = points > 0 ? "success" : points < 0 ? "danger" : "neutral"
  const magnitude = Math.abs(points).toLocaleString("fr-CA")
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-xs font-medium",
        TONE_TEXT[tone],
      )}
    >
      {points !== 0 && <Arrow className="size-3.5" aria-hidden="true" />}
      <span aria-hidden="true">
        {points > 0 ? "+" : points < 0 ? "−" : ""}
        {magnitude} pts
      </span>
      <span className="sr-only">
        {points > 0
          ? `En hausse de ${magnitude} points`
          : points < 0
            ? `En baisse de ${magnitude} points`
            : "Stable"}
      </span>
    </span>
  )
}

/**
 * Carte de chiffre de l'espace étudiant : libellé mono, grand chiffre serif,
 * contexte. Rendu serveur possible (aucun état) : l'icône Lucide y passe en
 * prop sans franchir de frontière client.
 */
export const VitalCard = ({
  label,
  value,
  unit,
  icon: Icon,
  subtitle,
  trend,
}: VitalCardProps) => (
  <div className="bg-surface border-line shadow-1 flex flex-col gap-2.5 rounded-lg border p-5">
    <div className="flex items-center justify-between gap-2">
      <span className="type-label">{label}</span>
      {Icon && <Icon className="text-ink-4 size-4" aria-hidden="true" />}
    </div>
    <p className="flex items-baseline gap-1.5">
      <span className="text-ink font-serif text-3xl leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      {unit && value !== "—" && (
        <span className="text-ink-3 text-sm">{unit}</span>
      )}
    </p>
    {(subtitle || (trend !== undefined && trend !== null)) && (
      <p className="text-ink-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {trend !== undefined && trend !== null && <Trend points={trend} />}
        {subtitle}
      </p>
    )}
  </div>
)
