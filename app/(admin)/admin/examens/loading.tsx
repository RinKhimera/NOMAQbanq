import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

// La page examens liste des CARTES, pas une table.
export default function Loading() {
  return <AdminListSkeleton statCount={4} layout="cards" />
}
