import { redirect } from "next/navigation"
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

  const session = await getExamSession(examId)

  // Déjà soumis → résumé (UX conservée, évite un examen re-jouable).
  if (session?.status === "completed" || session?.status === "auto_submitted") {
    redirect(`/tableau-de-bord/examen-blanc/${examId}/soumis`)
  }

  const data = await getExamWithQuestions(examId)
  // Non-abonné (DAL → null) : renvoyé vers la carte paywall de la page détail.
  if (!data) redirect(`/tableau-de-bord/examen-blanc/${examId}`)

  // Invariante anti-fuite : les questions ne partent dans le payload RSC que pour
  // une participation in_progress (créée par startExam, seul à vérifier
  // fenêtre+accès+audience). Sans participation → écran de démarrage sans
  // questions ; le client fait router.refresh() après startExam pour les
  // recevoir. Ferme subscribers, restricted ET le pré-fetch pré-fenêtre.
  const inProgress = session?.status === "in_progress"
  const initialAnswersRaw = inProgress
    ? await getExamAnswersForParticipation(examId)
    : []

  return (
    <EvaluationClient
      examId={examId}
      exam={{
        title: data.exam.title,
        completionTime: data.exam.completionTime,
        enablePause: data.exam.enablePause,
        pauseDurationMinutes: data.exam.pauseDurationMinutes,
      }}
      questions={inProgress ? data.questions : []}
      initialSession={session}
      initialAnswersRaw={initialAnswersRaw}
    />
  )
}
