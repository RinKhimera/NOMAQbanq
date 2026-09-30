import { Skeleton } from "@/components/ui/skeleton"

const panel = "bg-surface border-line flex flex-col gap-3 rounded-lg border p-5"

/** En-tête, bande de chiffres, deux rangées de panneaux. */
export default function Loading() {
  return (
    <output
      aria-label="Chargement du tableau de bord"
      className="flex w-full flex-col gap-5 p-4 lg:p-6"
    >
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-8 w-60" />
      </div>
      <div className="bg-line border-line grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-surface flex flex-col gap-2 px-5 py-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-7 w-2/3" />
          </div>
        ))}
      </div>
      {[0, 1].map((row) => (
        <div key={row} className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((k) => (
            <div key={k} className={panel}>
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-40" />
            </div>
          ))}
        </div>
      ))}
    </output>
  )
}
