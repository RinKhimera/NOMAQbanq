import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Carte de la fiche : libellé mono, titre, description et action à droite. */
export const DetailCard = ({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  testId,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  testId?: string
}) => (
  <section
    data-testid={testId}
    className={cn(
      "bg-surface border-line shadow-1 flex flex-col rounded-lg border",
      className,
    )}
  >
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-5 pt-5 md:px-6",
        children ? "pb-4" : "pb-5",
      )}
    >
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
        <p className="type-label">{eyebrow}</p>
        <h2 className="type-h4 text-ink">{title}</h2>
        {description && (
          <p className="text-ink-3 text-sm leading-normal">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 max-sm:w-full">{action}</div>}
    </div>
    {children && <div className={bodyClassName}>{children}</div>}
  </section>
)
