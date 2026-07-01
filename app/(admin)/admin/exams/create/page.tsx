import {
  getEligibleExamCandidates,
  getExamsForPicker,
} from "@/features/exams/dal"
import { ExamCreateForm } from "./_components/exam-create-form"

export default async function AdminCreateExamPage() {
  const [candidates, examOptions] = await Promise.all([
    getEligibleExamCandidates(),
    getExamsForPicker(),
  ])

  return <ExamCreateForm candidates={candidates} examOptions={examOptions} />
}
