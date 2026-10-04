import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard } from "@/components/ui/skeleton-patterns"

// Un seul formulaire centré : ni le squelette du tableau de bord, ni la
// page générique.
export default function Loading() {
  return (
    <output
      aria-label="Chargement de la page"
      className="mx-auto flex w-full max-w-130 flex-col gap-5 py-2 md:py-6"
    >
      <Skeleton className="h-6 w-full" />
      <SkeletonCard className="h-96" />
    </output>
  )
}
