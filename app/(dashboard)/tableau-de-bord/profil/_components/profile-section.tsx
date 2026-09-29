import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Section du profil, cible d'une ancre du sommaire : `scroll-mt` la dégage
 * des barres collantes de la coquille au saut.
 */
export const ProfileSection = ({
  id,
  title,
  description,
  danger = false,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  danger?: boolean
  children: ReactNode
}) => (
  <section
    id={id}
    aria-labelledby={`${id}-title`}
    className={cn(
      "bg-surface shadow-1 flex scroll-mt-[calc(var(--shell-offset)+1.5rem)] flex-col gap-4.5 rounded-lg border p-6 max-md:p-5",
      danger ? "border-danger-line" : "border-line",
    )}
  >
    <div className="flex flex-col gap-1">
      <h2
        id={`${id}-title`}
        className={cn("type-h4", danger ? "text-danger-ink" : "text-ink")}
      >
        {title}
      </h2>
      {description && <p className="text-ink-3 text-sm">{description}</p>}
    </div>
    {children}
  </section>
)

/** Ligne de section : icône, titre et détail, action à droite. */
export const ProfileRow = ({
  icon,
  title,
  detail,
  badge,
  action,
  testId,
}: {
  icon: ReactNode
  title: ReactNode
  detail?: ReactNode
  badge?: ReactNode
  action?: ReactNode
  testId?: string
}) => (
  <div
    data-testid={testId}
    className="border-line grid grid-cols-[1.125rem_minmax(0,1fr)_auto] items-center gap-3.5 border-t py-3.5 first:border-t-0 first:pt-0 max-md:grid-cols-[1.125rem_minmax(0,1fr)]"
  >
    <span className="text-ink-3 [&_svg]:size-4">{icon}</span>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-ink flex flex-wrap items-center gap-2 text-[0.9375rem] wrap-anywhere">
        {title}
        {badge}
      </span>
      {detail && (
        <span className="text-ink-3 text-[0.8125rem] wrap-anywhere">
          {detail}
        </span>
      )}
    </div>
    {action && <div className="shrink-0 max-md:col-start-2">{action}</div>}
  </div>
)
