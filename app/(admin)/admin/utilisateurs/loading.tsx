import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton"

export default function Loading() {
  return <AdminListSkeleton statCount={5} columns={6} />
}
