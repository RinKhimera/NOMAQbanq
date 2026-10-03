import { Skeleton } from "@/components/ui/skeleton"

/** Squelette à la forme de la carte d'état du retour de paiement. */
export const PaymentStatusSkeleton = () => (
  <div className="grid min-h-[min(70vh,680px)] place-items-center py-6">
    <div
      aria-busy="true"
      aria-label="Chargement"
      className="bg-surface border-line shadow-1 flex w-full max-w-130 flex-col gap-5 rounded-lg border p-8 max-[480px]:px-5 max-[480px]:py-6"
    >
      <div className="flex flex-col gap-2">
        <div className="mb-2 flex items-center gap-2.5">
          <Skeleton className="size-5" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-3/4 max-w-80" />
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <div className="flex flex-wrap gap-2.5 pt-1">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-44" />
      </div>
    </div>
  </div>
)
