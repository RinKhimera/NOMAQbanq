import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

export default function Loading() {
  return <AdminListSkeleton statCount={3} columns={6} />
}
