import { Skeleton } from "@/components/ui/skeleton"
import {
  SkeletonCard,
  SkeletonStatRow,
  SkeletonTable,
} from "@/components/ui/skeleton-patterns"

type AdminListSkeletonProps = {
  statCount?: number
  /** Nombre de colonnes de la table réelle — ignoré si `layout="cards"`. */
  columns?: number
  /** `examens` liste des cartes, pas une table : le gabarit doit suivre. */
  layout?: "table" | "cards"
}

/**
 * Squelette des 4 écrans de liste admin (utilisateurs, questions, examens,
 * transactions), qui partagent la même anatomie : stat cards → barre de filtres
 * → liste paginée. Monté par le `loading.tsx` de ces routes UNIQUEMENT — leurs
 * segments enfants (détail, création, modification) ont leur propre `loading.tsx`
 * avec `PageSkeleton`, sinon ils hériteraient d'un squelette de liste.
 *
 * `statCount` et `columns` doivent refléter le contenu RÉEL de chaque route
 * (relevés dans le DOM le 2026-07-29) — un gabarit approximatif annonce une
 * structure fausse.
 */
export const AdminListSkeleton = ({
  statCount = 4,
  columns = 5,
  layout = "table",
}: AdminListSkeletonProps) => (
  <output
    aria-label="Chargement de la liste"
    className="flex w-full flex-col gap-6 p-4 md:gap-8 lg:p-6"
  >
    <div className="space-y-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
    <SkeletonStatRow count={statCount} />
    <div className="flex flex-wrap gap-3">
      <Skeleton className="h-10 min-w-64 flex-1" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-10 w-40" />
    </div>
    {layout === "cards" ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    ) : (
      <SkeletonTable columns={columns} rows={8} />
    )}
  </output>
)
