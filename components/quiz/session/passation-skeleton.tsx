import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonText } from "@/components/ui/skeleton-patterns"

/** Forme d'une passation plein écran : barre, carte de question, navigateur. */
export const PassationSkeleton = ({ label }: { label: string }) => (
  <output aria-label={label} className="flex flex-col">
    <div className="border-line bg-surface flex h-14 items-center justify-between gap-4 border-b px-5">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-8 w-28 rounded-md" />
    </div>
    <div className="mx-auto flex w-full max-w-290 items-start gap-6 px-4 pt-6 sm:px-6">
      <div className="bg-surface border-line flex min-w-0 flex-1 flex-col gap-5 rounded-lg border p-5">
        <Skeleton className="h-3 w-32" />
        <SkeletonText lines={4} />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-sm" />
          ))}
        </div>
      </div>
      <div className="bg-surface border-line hidden w-75 shrink-0 rounded-lg border p-5 lg:block">
        <Skeleton className="mb-4 h-3 w-24" />
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-6.5 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  </output>
)
