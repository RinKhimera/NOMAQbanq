import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonText } from "@/components/ui/skeleton-patterns"

/** Forme d'une QuestionCard : énoncé puis options de réponse. */
export const EvaluationSkeleton = () => (
  <output
    aria-label="Chargement de l'évaluation"
    className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6"
  >
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-24" />
    </div>
    <Skeleton className="h-2 w-full rounded-full" />
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <SkeletonText lines={4} />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  </output>
)
