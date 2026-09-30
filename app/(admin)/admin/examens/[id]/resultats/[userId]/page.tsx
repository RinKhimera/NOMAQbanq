import { notFound } from "next/navigation"
import { SessionResults } from "@/components/quiz/results/session-results"
import type { AnswersMap } from "@/components/quiz/runner/types"
import { getExamPercentileForUser } from "@/features/analytics/dal"
import { loadExamQuestionExplanations } from "@/features/exams/actions"
import { getParticipantExamResults } from "@/features/exams/dal"
import { ParticipantResultsError } from "./_components/participant-results-error"

export default async function AdminParticipantResultsPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id, userId } = await params
  const [data, percentile] = await Promise.all([
    getParticipantExamResults(id, userId),
    getExamPercentileForUser(id, userId),
  ])
  if (!data) notFound()
  // Un admin n'est jamais soumis à l'accès payant : cette branche est
  // structurellement morte ici, le type seul l'impose.
  if ("error" in data && data.error === "ACCESS_REQUIRED") notFound()

  if ("error" in data) {
    return (
      <ParticipantResultsError
        error={data.error}
        message={data.message}
        status={"status" in data ? data.status : undefined}
        examTitle={data.exam.title}
        examId={id}
        participantUser={data.participantUser}
      />
    )
  }

  const questions = data.questions

  // Map DAL answers → AnswersMap (sparse-safe)
  const answers: AnswersMap = {}
  for (const a of data.participant.answers) {
    if (a.selectedAnswer !== null && a.selectedAnswer !== "") {
      answers[a.questionId] = {
        selected: a.selectedAnswer,
        isCorrect: a.isCorrect ?? undefined,
      }
    }
  }

  // `null` = score retenu par la DAL, jamais transmis au client.
  const score = data.participant.score

  const participant = data.participantUser
    ? {
        name: data.participantUser.name ?? "",
        email: data.participantUser.email,
        image: data.participantUser.image,
      }
    : undefined

  return (
    <SessionResults
      kind="exam"
      score={score}
      questions={questions}
      answers={answers}
      flaggedIds={data.participant.answers
        .filter((a) => a.isFlagged)
        .map((a) => a.questionId)}
      loadExplanations={loadExamQuestionExplanations}
      participant={participant}
      percentile={percentile}
      percentileSubject="participant"
      eyebrow={data.exam.title}
      backHref={`/admin/examens/${id}`}
      backLabel="Retour au classement"
    />
  )
}
