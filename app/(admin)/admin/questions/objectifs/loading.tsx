import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard } from "@/components/ui/skeleton-patterns"

export default function Loading() {
  return (
    <div
      className="flex flex-col gap-5 p-4 lg:p-6"
      aria-busy="true"
      aria-label="Chargement des objectifs"
    >
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-10 w-80" />
      {Array.from({ length: 3 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
