import { PageSkeleton } from "@/components/ui/skeleton-patterns"

// Le parent `entrainement` porte un squelette dédié à la page de configuration :
// les résultats déclarent le leur pour ne pas en hériter.
export default function Loading() {
  return <PageSkeleton />
}
