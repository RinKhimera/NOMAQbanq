import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard } from "@/components/ui/skeleton-patterns"

// Forme de la vue de pilotage : en-tête, carte « En cours », deux colonnes
// « À préparer », tableau « Terminés ». Les enfants (fiche, formulaire)
// déclarent leur propre squelette.
export default function Loading() {
  return (
    <output
      aria-label="Chargement des examens"
      className="flex w-full flex-col gap-8 p-4 lg:p-6"
    >
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </output>
  )
}
