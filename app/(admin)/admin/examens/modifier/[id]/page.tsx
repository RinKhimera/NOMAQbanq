import { notFound } from "next/navigation"
import {
  getAdminExam,
  getEligibleSubscriberCount,
  getExamAudience,
  getExamFigures,
} from "@/features/exams/dal"
import { getExamSelection } from "@/features/questions/dal"
import { currentTimeMs } from "@/lib/clock"
import { ExamForm } from "../../_components/exam-form"
import { examFormFromExam } from "../../_components/exam-form-model"

export default async function AdminEditExamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getAdminExam(id)
  if (!data) notFound()
  const { exam } = data

  const [audience, selection, figures, subscriberCount] = await Promise.all([
    exam.audienceType === "restricted" ? getExamAudience(id) : [],
    getExamSelection(id),
    getExamFigures(id),
    getEligibleSubscriberCount(),
  ])

  return (
    <ExamForm
      key={id}
      initialNow={currentTimeMs()}
      subscriberCount={subscriberCount}
      initialValues={examFormFromExam(exam, audience)}
      saved={{
        id,
        title: exam.title,
        startDate: exam.startDate,
        endDate: exam.endDate,
        finalizedAt: exam.finalizedAt,
        isActive: exam.isActive,
        targetQuestionCount: exam.targetQuestionCount,
        questionCount: exam.questionCount,
        started: figures?.started ?? 0,
        locked: figures?.locked ?? false,
      }}
      selection={selection}
      reopening={null}
    />
  )
}
