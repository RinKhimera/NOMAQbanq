import { notFound } from "next/navigation"
import {
  getExamAnswersForParticipation,
  getExamSession,
  getExamWithQuestions,
} from "@/features/exams/dal"
import { EvaluationClient } from "./_components/evaluation-client"

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = await params
  const data = await getExamWithQuestions(examId)
  if (!data) notFound()

  const [session, initialAnswersRaw] = await Promise.all([
    getExamSession(examId),
    getExamAnswersForParticipation(examId),
  ])

  return (
    <EvaluationClient
      examId={examId}
      exam={{
        title: data.exam.title,
        completionTime: data.exam.completionTime,
        enablePause: data.exam.enablePause,
        pauseDurationMinutes: data.exam.pauseDurationMinutes,
      }}
      questions={data.questions}
      initialSession={session}
      initialAnswersRaw={initialAnswersRaw}
    />
  )
}
