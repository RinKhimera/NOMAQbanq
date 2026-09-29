import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Du mobile vers le large : `max-lg:` l'emporterait sur `max-[480px]:` dans
// le CSS généré, et la grille resterait à deux colonnes sous 480 px.
/** Grille des quatre VitalCard : 1, 2 puis 4 colonnes. */
export const VITAL_GRID =
  "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4"

type DashboardCardProps = {
  eyebrow: string
  title: string
  action?: ReactNode
  /** `flush` : le contenu (un tableau) va jusqu'aux bords de la carte. */
  flush?: boolean
  className?: string
  children: ReactNode
}

/** Carte de section du tableau de bord : libellé mono, titre `h2`, action à droite. */
export const DashboardCard = ({
  eyebrow,
  title,
  action,
  flush = false,
  className,
  children,
}: DashboardCardProps) => (
  <section
    className={cn(
      "bg-surface border-line shadow-1 flex min-w-0 flex-col gap-4 rounded-lg border",
      flush ? "pt-5" : "p-5 md:p-6",
      className,
    )}
  >
    <div
      className={cn(
        "flex items-start justify-between gap-3",
        flush && "px-5 md:px-6",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-label">{eyebrow}</p>
        <h2 className="type-h4 text-ink">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
)
