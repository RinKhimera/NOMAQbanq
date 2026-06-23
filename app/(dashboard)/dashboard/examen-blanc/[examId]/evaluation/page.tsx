import { notFound } from "next/navigation"
import { getExamSession, getExamWithQuestions } from "@/features/exams/dal"
import { EvaluationClient } from "./_components/evaluation-client"

// Hors composant : isole l'horloge (impure) du corps de rendu (react-hooks/purity).
const currentTimeMs = () => Date.now()

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = await params
  const data = await getExamWithQuestions(examId)
  if (!data) notFound()

  const session = await getExamSession(examId)

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
      initialNow={currentTimeMs()}
    />
  )
}
