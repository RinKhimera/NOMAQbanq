import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard, SkeletonText } from "@/components/ui/skeleton-patterns"

/** Forme réelle de l'écran : formulaire de configuration, puis historique. */
export const EntrainementSkeleton = () => (
  <output
    aria-label="Chargement de l'entraînement"
    className="flex w-full flex-col gap-6 p-4 md:gap-8 lg:p-6"
  >
    <div className="space-y-3">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <Skeleton className="mb-6 h-6 w-56" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <Skeleton className="mt-6 h-11 w-48" />
    </div>
    <SkeletonCard />
    <SkeletonText lines={2} />
  </output>
)
