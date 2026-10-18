import { Skeleton } from "@/components/ui/skeleton"
import {
  SkeletonCard,
  SkeletonStatRow,
  SkeletonTable,
} from "@/components/ui/skeleton-patterns"

// Fil d'Ariane et navigation, puis la page Progression de l'étudiant. Le
// parent porte le squelette du tableau : cette route déclare le sien.
export default function Loading() {
  return (
    <output
      aria-label="Chargement de la progression de l'étudiant"
      className="flex w-full flex-col gap-5 p-4 lg:p-6"
    >
      <Skeleton className="h-3 w-44" />
      <div className="flex flex-wrap justify-between gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="space-y-3 pb-1">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <SkeletonStatRow count={4} />
      <SkeletonTable columns={5} rows={8} />
      <SkeletonTable columns={6} rows={5} />
      <SkeletonCard className="h-64" />
    </output>
  )
}
