import { MARKETING_CLAIMS } from "@/constants"
import type { MarketingStats } from "@/features/marketing/dal"
import { cn } from "@/lib/utils"

export type MarketingFigure = { value: string; label: string }

/** Les quatre chiffres de l'accueil, repris par À propos et l'authentification. */
export const publicFigures = (stats: MarketingStats): MarketingFigure[] => [
  { value: stats.totalQuestions, label: "QCM basés sur les objectifs du CMC" },
  { value: stats.successRate, label: "de réussite chez nos candidats" },
  { value: MARKETING_CLAIMS.rating, label: "note moyenne des candidats" },
  { value: stats.totalUsers, label: "candidats inscrits" },
]

type MarketingFiguresProps = {
  figures: readonly MarketingFigure[]
  /**
   * `row` : cellules côte à côte (4 colonnes, 2 sous 768 px), dans la bande
   * d'un héros. `list` : une carte, une ligne par chiffre, valeur à droite.
   */
  layout?: "row" | "list"
  className?: string
}

/**
 * Grille des chiffres publics de la vitrine. Les valeurs viennent des
 * statistiques en cache et de `MARKETING_CLAIMS`, jamais écrites en dur.
 */
export const MarketingFigures = ({
  figures,
  layout = "row",
  className,
}: MarketingFiguresProps) => {
  if (layout === "list") {
    return (
      <dl
        className={cn(
          "border-line bg-line grid gap-px overflow-hidden rounded-lg border",
          className,
        )}
      >
        {figures.map((f) => (
          <div
            key={f.label}
            className="bg-surface flex items-baseline justify-between gap-4 px-6 py-5"
          >
            <dt className="text-ink-3 text-sm">{f.label}</dt>
            <dd className="text-ink font-serif text-[1.75rem] font-semibold tracking-[-0.02em]">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl
      className={cn(
        "bg-line grid grid-cols-2 gap-px md:grid-cols-4",
        className,
      )}
    >
      {figures.map((f) => (
        <div key={f.label} className="bg-surface flex flex-col gap-1 p-6">
          <dt className="text-ink-3 order-2 text-sm">{f.label}</dt>
          <dd className="text-ink order-1 font-serif text-[2rem] leading-[1.1] font-semibold tracking-[-0.02em]">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
