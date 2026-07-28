import { Skeleton } from "@/components/ui/skeleton"
import {
  SkeletonStatRow,
  SkeletonTable,
} from "@/components/ui/skeleton-patterns"

type AdminListSkeletonProps = {
  statCount?: number
  columns?: number
}

/**
 * Squelette des 4 écrans de liste admin (utilisateurs, questions, examens,
 * transactions), qui partagent la même anatomie : stat cards → barre de filtres
 * → table paginée. Monté par le `loading.tsx` de ces routes UNIQUEMENT — leurs
 * segments enfants (détail, création, modification) ont leur propre `loading.tsx`
 * avec `PageSkeleton`, sinon ils hériteraient d'un squelette de liste.
 */
export const AdminListSkeleton = ({
  statCount = 4,
  columns = 5,
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
    <SkeletonTable columns={columns} rows={8} />
  </output>
)
