import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Carte du tableau de bord admin : libellé mono, titre, contenu. */
export const DashboardPanel = ({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) => (
  <section
    className={cn(
      "bg-surface border-line shadow-1 flex min-w-0 flex-col gap-4 rounded-lg border p-5 max-md:p-4",
      className,
    )}
  >
    <div className="flex flex-col gap-0.5">
      <span className="type-label">{eyebrow}</span>
      <h2 className="type-h4 text-ink">{title}</h2>
      {description && (
        <p className="text-ink-3 text-[0.8125rem]">{description}</p>
      )}
    </div>
    {children}
  </section>
)
