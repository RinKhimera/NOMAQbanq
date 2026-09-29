import { Skeleton } from "@/components/ui/skeleton"
import {
  SkeletonCard,
  SkeletonStatRow,
  SkeletonTable,
} from "@/components/ui/skeleton-patterns"

// Reprend la mise en page du tableau de bord (en-tête, chiffres, deux
// courbes, maîtrise et anneau, examens récents) avec les motifs partagés.
export default function Loading() {
  return (
    <output aria-label="Chargement du tableau de bord" className="contents">
      <div className="space-y-3 pb-1">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <SkeletonStatRow count={4} />
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-72" />
      </div>
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3 max-lg:grid-cols-1">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable columns={5} rows={5} />
    </output>
  )
}
