import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard } from "@/components/ui/skeleton-patterns"

/** En-tête (avatar, nom), sommaire latéral et sections du profil, avec les motifs partagés. */
export const ProfileSkeleton = () => {
  return (
    <output aria-label="Chargement du profil" className="contents">
      <div className="flex items-center gap-4 pb-2">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </output>
  )
}
