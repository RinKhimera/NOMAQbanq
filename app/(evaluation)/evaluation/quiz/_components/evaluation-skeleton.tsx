import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonText } from "@/components/ui/skeleton-patterns"

/** Forme de la passation : barre de session, puis une QuestionCard. */
export const EvaluationSkeleton = () => (
  <output
    aria-label="Chargement de l'évaluation"
    className="bg-background block min-h-screen"
  >
    <h1 className="sr-only">Évaluation gratuite</h1>
    <div className="bg-surface border-line flex h-14 items-center justify-between gap-4 border-b px-5">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-20" />
    </div>
    <div className="mx-auto flex max-w-200 flex-col gap-4 px-4 pt-8 pb-16 sm:px-6">
      <div className="bg-surface border-line rounded-lg border">
        <div className="border-line flex gap-2.5 border-b px-5 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-5 px-5 pt-6 pb-5">
          <SkeletonText lines={4} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  </output>
)
