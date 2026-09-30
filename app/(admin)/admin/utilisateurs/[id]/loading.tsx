import { Skeleton } from "@/components/ui/skeleton"

const box = "bg-surface border-line flex flex-col gap-3 rounded-lg border p-5"

/** Fil d'Ariane, en-tête du compte, blocs Accès et Paiements. */
export default function Loading() {
  return (
    <output
      aria-label="Chargement de la fiche"
      className="flex w-full flex-col gap-4 p-4 lg:p-6"
    >
      <Skeleton className="h-3 w-44" />
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-64 max-w-[60%]" />
          <Skeleton className="h-3 w-80 max-w-[80%]" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {[0, 1].map((k) => (
          <div key={k} className={box}>
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ))}
      </div>
      <div className={box}>
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-16" />
      </div>
    </output>
  )
}
