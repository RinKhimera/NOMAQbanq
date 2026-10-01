import { Skeleton } from "@/components/ui/skeleton"

const box = "bg-surface border-line flex flex-col gap-3 rounded-lg border p-5"

/** Fil d'Ariane, en-tête, question corrigée et colonne de la répartition. */
export default function Loading() {
  return (
    <output
      aria-label="Chargement de la question"
      className="flex w-full flex-col gap-4 p-4 lg:p-6"
    >
      <Skeleton className="h-3 w-56" />
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-7 w-[min(420px,80%)]" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className={box}>
          {[92, 88, 70].map((w) => (
            <Skeleton key={w} className="h-4" style={{ width: `${w}%` }} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <div className={box}>
          <Skeleton className="h-3 w-2/5" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
      </div>
    </output>
  )
}
