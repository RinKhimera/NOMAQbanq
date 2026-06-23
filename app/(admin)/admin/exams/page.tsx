import {
  getActiveExamAccessCount,
  getAllExamsAdmin,
  getExamsStats,
} from "@/features/exams/dal"
import { AdminExamsClient } from "./_components/admin-exams-client"

export default async function AdminExamsPage() {
  const [stats, exams, eligibleCount] = await Promise.all([
    getExamsStats(),
    getAllExamsAdmin(),
    getActiveExamAccessCount(),
  ])

  return (
    <AdminExamsClient
      stats={stats}
      exams={exams}
      eligibleCount={eligibleCount}
    />
  )
}
