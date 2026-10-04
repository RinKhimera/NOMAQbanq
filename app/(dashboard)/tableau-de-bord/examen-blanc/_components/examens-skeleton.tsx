import { Skeleton } from "@/components/ui/skeleton"

const CARD = "bg-surface border-line rounded-lg border"

/** Forme réelle de l'écran : en-tête, trois chiffres, examen ouvert, lignes. */
export const ExamensSkeleton = () => (
  <output
    aria-label="Chargement des examens"
    className="flex w-full flex-col gap-5"
  >
    <div className="flex flex-col gap-2.5 pb-1">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-[min(300px,80%)]" />
      <Skeleton className="h-3.5 w-[min(560px,95%)]" />
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${CARD} flex flex-col gap-3 p-5`}>
          <Skeleton className="h-2.5 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
      ))}
    </div>
    <div className={`${CARD} p-5 md:px-8 md:py-7`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-3/5" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div className="border-line flex flex-col gap-4 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <Skeleton className="h-2.5 w-1/2" />
          <Skeleton className="h-8 w-3/5" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
    </div>
    <div className={CARD}>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="border-line grid grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,220px)_7.5rem] items-center gap-4 border-t px-4 py-3 first:border-t-0 max-md:grid-cols-[3rem_minmax(0,1fr)]"
        >
          <Skeleton className="h-12 rounded-md" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-2 max-md:hidden" />
          <span />
        </div>
      ))}
    </div>
  </output>
)
