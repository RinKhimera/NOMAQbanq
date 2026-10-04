import { Skeleton } from "@/components/ui/skeleton"

const column =
  "bg-surface border-line flex flex-col gap-3.5 rounded-lg border p-4"

/** Fil d'Ariane, titre, compteur, puis la banque et la sélection côte à côte. */
export default function Loading() {
  return (
    <output
      aria-label="Chargement du jeu de questions"
      className="flex w-full flex-col gap-4 p-4 lg:p-6"
    >
      <Skeleton className="h-3 w-80 max-w-full" />
      <Skeleton className="h-7.5 w-[min(380px,80%)]" />
      <Skeleton className="h-14" />
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {[0, 1].map((c) => (
          <div key={c} className={c === 1 ? `${column} max-lg:hidden` : column}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.25 w-[92%]" />
                <Skeleton className="h-2.75 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </output>
  )
}
