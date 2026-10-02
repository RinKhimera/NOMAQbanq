import type { ReactNode } from "react"

type OverviewSectionProps = {
  id: string
  title: string
  count: number
  /** Texte calé à droite de l'en-tête (moyenne des derniers terminés). */
  extra?: ReactNode
  empty: string
  children: ReactNode
}

export const OverviewSection = ({
  id,
  title,
  count,
  extra,
  empty,
  children,
}: OverviewSectionProps) => (
  <section
    aria-labelledby={`${id}-title`}
    data-testid={`exams-section-${id}`}
    className="flex flex-col gap-3"
  >
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h2 id={`${id}-title`} className="type-h4 text-ink">
        {title}
      </h2>
      <span className="text-ink-3 font-mono text-[0.8125rem]">{count}</span>
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
    {count === 0 ? (
      <p className="bg-surface border-line text-ink-3 rounded-lg border px-5 py-4 text-sm">
        {empty}
      </p>
    ) : (
      children
    )}
  </section>
)
