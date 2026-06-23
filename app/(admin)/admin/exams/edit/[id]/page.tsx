import { notFound } from "next/navigation"
import {
  getEligibleExamCandidates,
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

  const candidates = await getEligibleExamCandidates()

  return (
    <ExamEditForm
      examId={id}
      exam={data.exam}
      questions={data.questions}
      candidates={candidates}
    />
  )
}
