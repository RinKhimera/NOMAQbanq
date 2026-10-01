import { notFound } from "next/navigation"
import {
  getAdminExam,
  getEligibleExamCandidates,
  getExamAudience,
} from "@/features/exams/dal"
import { ExamForm } from "../../_components/exam-form"

export default async function AdminEditExamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getAdminExam(id)
  if (!data) notFound()

  const [candidates, initialAudience] = await Promise.all([
    getEligibleExamCandidates(),
    getExamAudience(id),
  ])

  return (
    <ExamForm
      mode="edit"
      examId={id}
      exam={data.exam}
      questionIds={data.questions.map((q) => q._id)}
      candidates={candidates}
      initialAudience={initialAudience}
    />
  )
}
