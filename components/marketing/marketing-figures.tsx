import { DOMAINS } from "@/constants/domains"
import type { MarketingStats } from "@/features/marketing/dal"
import { cn } from "@/lib/utils"

export type MarketingFigure = { value: string; label: string }

/**
 * Les chiffres publics de la vitrine, tous comptés : le taux de réussite aux
 * examens blancs n'y entre que s'il est publiable.
 */
export const publicFigures = (stats: MarketingStats): MarketingFigure[] => [
  { value: stats.totalQuestions, label: "QCM basés sur les objectifs du CMC" },
  { value: String(DOMAINS.length), label: "domaines médicaux" },
  { value: stats.totalUsers, label: "candidats inscrits" },
  ...(stats.successRate === null
    ? []
    : [{ value: stats.successRate, label: "de réussite aux examens blancs" }]),
]

type MarketingFiguresProps = {
  figures: readonly MarketingFigure[]
  /**
   * `row` : cellules côte à côte (une colonne par chiffre, 2 sous 768 px), dans la bande
   * d'un héros. `list` : une carte, une ligne par chiffre, valeur à droite.
   */
  layout?: "row" | "list"
  className?: string
}

/**
 * Grille des chiffres publics de la vitrine. Les valeurs viennent des
 * statistiques en cache et de `DOMAINS`, jamais écrites en dur.
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
        "bg-line grid grid-cols-2 gap-px",
        figures.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4",
        className,
      )}
    >
      {figures.map((f, i) => (
        <div
          key={f.label}
          className={cn(
            "bg-surface flex flex-col gap-1 p-6",
            // Un nombre impair de chiffres : le dernier occupe toute la
            // ligne sur deux colonnes, sans case vide à côté.
            figures.length % 2 === 1 &&
              i === figures.length - 1 &&
              "max-md:col-span-2",
          )}
        >
          <dt className="text-ink-3 order-2 text-sm">{f.label}</dt>
          <dd className="text-ink order-1 font-serif text-[2rem] leading-[1.1] font-semibold tracking-[-0.02em]">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
