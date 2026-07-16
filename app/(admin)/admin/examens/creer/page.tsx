import {
  getEligibleExamCandidates,
  getExamsForPicker,
} from "@/features/exams/dal"
import { ExamForm } from "../_components/exam-form"

export default async function AdminCreateExamPage() {
  const [candidates, examOptions] = await Promise.all([
    getEligibleExamCandidates(),
    getExamsForPicker(),
  ])

  return (
    <ExamForm mode="create" candidates={candidates} examOptions={examOptions} />
  )
}
