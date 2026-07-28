import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const LINE_WIDTHS = ["w-full", "w-11/12", "w-9/12", "w-10/12", "w-8/12"]

/** n lignes de texte en creux, de largeur décroissante pour éviter l'effet « bloc ». */
export const SkeletonText = ({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        className={cn("h-4", LINE_WIDTHS[i % LINE_WIDTHS.length])}
      />
    ))}
  </div>
)

/** Carte générique : en-tête + corps. */
export const SkeletonCard = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900",
      className,
    )}
  >
    <div className="mb-4 flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-5 w-40" />
    </div>
    <SkeletonText lines={3} />
  </div>
)

/** La rangée de cartes KPI présente sur les tableaux de bord et les listes admin. */
export const SkeletonStatRow = ({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) => (
  <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        data-testid="skeleton-stat"
        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="mt-2 h-3 w-28" />
      </div>
    ))}
  </div>
)

/**
 * Table en creux : hauteur figée pour qu'aucun saut de layout ne survienne à
 * l'arrivée des données.
 */
export const SkeletonTable = ({
  columns = 4,
  rows = 8,
  className,
}: {
  columns?: number
  rows?: number
  className?: string
}) => (
  <div
    className={cn(
      "overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900",
      className,
    )}
  >
    <div
      className="grid gap-4 border-b border-gray-200/80 p-4 dark:border-gray-700/50"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} className="h-4 w-24" />
      ))}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div
        key={r}
        className="grid gap-4 border-b border-gray-100 p-4 last:border-0 dark:border-gray-800"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className="h-5 w-full" />
        ))}
      </div>
    ))}
  </div>
)

/**
 * Repli de navigation des routes authentifiées sans squelette dédié. Toujours
 * monté explicitement par un `loading.tsx` — jamais hérité par accident d'un
 * segment parent, sous peine d'afficher la mauvaise forme.
 */
export const PageSkeleton = () => (
  <output
    aria-label="Chargement de la page"
    className="flex w-full flex-col gap-6 p-4 md:gap-8 lg:p-6"
  >
    <div className="space-y-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
    <SkeletonStatRow count={4} />
    <SkeletonCard />
  </output>
)
