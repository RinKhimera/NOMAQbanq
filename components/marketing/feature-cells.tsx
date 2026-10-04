import { cn } from "@/lib/utils"

export type FeatureCell = { title: string; description: string }

type FeatureCellsProps = {
  items: readonly FeatureCell[]
  columns?: 3 | 4
  /** `h3` serif 22 px (valeurs, étapes) ou `h4` sans empattement (fonctionnalités). */
  titleSize?: "h3" | "h4"
  className?: string
}

const COLUMNS = {
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
} as const

/** Cellules numérotées « 01 Titre » séparées par des filets. */
export const FeatureCells = ({
  items,
  columns = 3,
  titleSize = "h4",
  className,
}: FeatureCellsProps) => (
  // Filets en bordures, rognés à droite et en bas par l'enveloppe : une
  // rangée incomplète laisse un vide, pas une case pleine de la couleur du filet.
  <div className={cn("border-line overflow-hidden border-y", className)}>
    <ol className={cn("-mr-px -mb-px grid", COLUMNS[columns])}>
      {items.map((item, i) => (
        <li
          key={item.title}
          className="border-line flex flex-col gap-2.5 border-r border-b px-6 pt-7 pb-8"
        >
          <span
            aria-hidden
            className="text-ink-3 font-mono text-xs tabular-nums"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3
            className={cn(
              "text-ink",
              titleSize === "h3" ? "type-h3 text-[1.375rem]" : "type-h4",
            )}
          >
            {item.title}
          </h3>
          <p className="text-ink-2 text-[15px] leading-relaxed text-pretty">
            {item.description}
          </p>
        </li>
      ))}
    </ol>
  </div>
)
