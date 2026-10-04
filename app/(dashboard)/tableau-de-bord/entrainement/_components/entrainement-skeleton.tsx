import { Skeleton } from "@/components/ui/skeleton"

const CARD = "bg-surface border-line rounded-lg border"

/** Forme réelle de l'écran : en-tête, série en cours, configuration et récapitulatif, historique. */
export const EntrainementSkeleton = () => (
  <output
    aria-label="Chargement de l'entraînement"
    className="flex w-full flex-col gap-5"
  >
    <div className="flex flex-col gap-2.5 pb-1">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-[min(340px,80%)]" />
      <Skeleton className="h-3.5 w-[min(520px,95%)]" />
    </div>
    <div className={`${CARD} flex flex-col gap-2.5 px-6 py-5`}>
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="h-4 w-[min(260px,70%)]" />
      <Skeleton className="h-1.5 w-[min(380px,90%)]" />
    </div>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <div className={`${CARD} flex flex-col gap-5.5 p-6`}>
        {[40, 40, 40, 64].map((height, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="w-full rounded-md" style={{ height }} />
          </div>
        ))}
      </div>
      <div className="bg-surface-2 border-line flex flex-col gap-3.5 rounded-lg border p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
    <div className={`${CARD} flex flex-col gap-3.5 p-6`}>
      <Skeleton className="h-4.5 w-44" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-3.5 w-full" />
      ))}
    </div>
  </output>
)
