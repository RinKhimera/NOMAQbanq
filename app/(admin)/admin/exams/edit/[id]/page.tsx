import { notFound } from "next/navigation"
import {
  getEligibleExamCandidates,
  getExamAudience,
  getExamWithQuestions,
} from "@/features/exams/dal"
import { ExamEditForm } from "./_components/exam-edit-form"

export default async function AdminEditExamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getExamWithQuestions(id)
  if (!data) notFound()

  const [candidates, initialAudience] = await Promise.all([
    getEligibleExamCandidates(),
    getExamAudience(id),
  ])

  return (
    <ExamEditForm
      examId={id}
      exam={data.exam}
      questionIds={data.questions.map((q) => q._id)}
      candidates={candidates}
      initialAudience={initialAudience}
    />
  )
}
