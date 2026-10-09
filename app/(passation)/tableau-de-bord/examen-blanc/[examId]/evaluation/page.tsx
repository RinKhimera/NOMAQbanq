import type { Metadata } from "next"
import { redirect } from "next/navigation"
import {
  getExamAnswersForParticipation,
  getExamSession,
  getExamWithQuestions,
} from "@/features/exams/dal"
import { currentTimeMs } from "@/lib/clock"
import { EvaluationClient } from "./_components/evaluation-client"

export const metadata: Metadata = { title: "Passation de l'examen" }

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
  // Non-abonné (DAL → null) : renvoyé vers la liste, qui dit ce qui manque.
  // Examen suspendu sans participation : rien à commencer, la liste le dit aussi.
  if (!data || (!data.exam.isActive && !session)) {
    redirect("/tableau-de-bord/examen-blanc")
  }

  // Invariante anti-fuite : les questions ne partent dans le payload RSC que pour
  // une participation in_progress (créée par startExam, seul à vérifier
  // fenêtre+accès+audience). Sans participation → écran de consignes sans
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
        questionCount: data.exam.questionCount,
        completionTime: data.exam.completionTime,
        enablePause: data.exam.enablePause,
        pauseDurationMinutes: data.exam.pauseDurationMinutes,
        endDate: data.exam.endDate,
      }}
      questions={inProgress ? data.questions : []}
      initialSession={session}
      initialAnswersRaw={initialAnswersRaw}
      initialNow={currentTimeMs()}
    />
  )
}
