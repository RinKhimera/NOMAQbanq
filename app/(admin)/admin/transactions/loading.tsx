import { Skeleton } from "@/components/ui/skeleton"

const box = "bg-surface border-line flex flex-col rounded-lg border"

/** Liste des clients à gauche, dossier à droite (variante « Dossier client »). */
export default function Loading() {
  return (
    <output
      aria-label="Chargement des transactions"
      className="flex w-full flex-col gap-5 p-4 lg:p-6"
    >
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-64 max-w-[70%]" />
      </div>
      <Skeleton className="h-3 w-96 max-w-full" />
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className={`${box} gap-3.5 p-4`}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
        <div className={`${box} gap-3.5 p-6 max-lg:hidden`}>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-15" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      </div>
    </output>
  )
}
