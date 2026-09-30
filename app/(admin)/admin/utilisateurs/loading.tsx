import { Skeleton } from "@/components/ui/skeleton"

/** Recherche et filtres, segments, liste de comptes. */
export default function Loading() {
  return (
    <output
      aria-label="Chargement des utilisateurs"
      className="flex w-full flex-col gap-5 p-4 lg:p-6"
    >
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full max-w-105" />
        <Skeleton className="h-10 w-47.5" />
        <Skeleton className="h-10 w-47.5" />
      </div>
      <Skeleton className="h-10 w-130 max-w-full" />
      <div className="bg-surface border-line flex flex-col gap-3.5 rounded-lg border p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </output>
  )
}
