import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

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
