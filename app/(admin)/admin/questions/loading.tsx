import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

export default function Loading() {
  return <AdminListSkeleton statCount={4} columns={8} />
}
