import { getAllExamsAdmin, getExamsStats } from "@/features/exams/dal"
import { AdminExamsClient } from "./_components/admin-exams-client"

export default async function AdminExamsPage() {
  const [stats, exams] = await Promise.all([
    getExamsStats(),
    getAllExamsAdmin(),
  ])

  return (
    <AdminExamsClient
      stats={stats}
      exams={exams}
      eligibleCount={stats.eligibleCandidates}
    />
  )
}
