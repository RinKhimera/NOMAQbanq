import { AdminDashboardSkeleton } from "@/components/admin/dashboard/skeleton"

// Fallback Suspense pendant que le Server Component charge le DAL (le squelette
// de chargement était perdu depuis la conversion en Server Component async).
export default function Loading() {
  return <AdminDashboardSkeleton />
}
