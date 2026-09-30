import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type StatBandItem = {
  label: string
  /** Valeur déjà formatée ; « — » sans donnée. */
  value: ReactNode
  /** Contexte en mono sous la valeur (tendance, détail). */
  sub?: ReactNode
}

const COLUMNS = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
} as const

/**
 * Bande de chiffres clés de l'admin : cellules séparées par des filets, grand
 * chiffre serif. Deux colonnes sur téléphone. Rendu serveur possible.
 */
export const StatBand = ({
  items,
  className,
}: {
  items: StatBandItem[]
  className?: string
}) => (
  <dl
    className={cn(
      // Les filets entre cellules sont le fond de la grille, vu à travers `gap-px`.
      "bg-line border-line grid grid-cols-2 gap-px overflow-hidden rounded-lg border",
      COLUMNS[Math.min(4, Math.max(1, items.length)) as 1 | 2 | 3 | 4],
      className,
    )}
  >
    {items.map((item) => (
      <div
        key={item.label}
        className="bg-surface flex min-w-0 flex-col gap-1 px-5 py-4"
      >
        <dt className="type-label">{item.label}</dt>
        <dd className="text-ink font-serif text-[1.625rem] leading-tight font-semibold">
          {item.value}
        </dd>
        {item.sub && (
          <dd className="text-ink-3 font-mono text-xs">{item.sub}</dd>
        )}
      </div>
    ))}
  </dl>
)
