import { getEligibleExamCandidates } from "@/features/exams/dal"
import { ExamCreateForm } from "./_components/exam-create-form"

export default async function AdminCreateExamPage() {
  const candidates = await getEligibleExamCandidates()

  return <ExamCreateForm candidates={candidates} />
}
