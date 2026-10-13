import { Skeleton } from "@/components/ui/skeleton"
import {
  SkeletonCard,
  SkeletonStatRow,
  SkeletonTable,
} from "@/components/ui/skeleton-patterns"

// En-tête, bande de quatre chiffres, tableau des domaines, historique des
// examens et courbe d'entraînement. Le parent porte le squelette du tableau
// de bord : cette route déclare le sien.
export default function Loading() {
  return (
    <output aria-label="Chargement de votre progression" className="contents">
      <div className="space-y-3 pb-1">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <SkeletonStatRow count={4} />
      <SkeletonTable columns={5} rows={8} />
      <SkeletonTable columns={6} rows={5} />
      <SkeletonCard className="h-64" />
    </output>
  )
}
