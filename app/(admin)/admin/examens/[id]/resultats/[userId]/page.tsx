import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  getExamLeaderboard,
  getParticipantExamResults,
} from "@/features/exams/dal"
import { rankOf } from "../../_components/exam-detail-model"
import { ExamCopyClient } from "./_components/exam-copy-client"
import { ParticipantResultsError } from "./_components/participant-results-error"

export const metadata: Metadata = { title: "Copie d'examen" }

export default async function AdminParticipantResultsPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id, userId } = await params
  const [data, leaderboard] = await Promise.all([
    getParticipantExamResults(id, userId),
    getExamLeaderboard(id),
  ])
  if (!data) notFound()
  // Un admin n'est jamais soumis à l'accès payant : cette branche est
  // structurellement morte ici, le type seul l'impose.
  if ("error" in data && data.error === "ACCESS_REQUIRED") notFound()

  if ("error" in data) {
    return (
      <ParticipantResultsError
        error={data.error}
        status={"status" in data ? data.status : undefined}
        exam={{ id, title: data.exam.title }}
        participantUser={data.participantUser}
      />
    )
  }

  const { participant, participantUser } = data

  return (
    <ExamCopyClient
      exam={{ id, title: data.exam.title }}
      participant={{
        participationId: participant.participationId,
        name: participantUser?.name ?? "Compte supprimé",
        image: participantUser?.image ?? null,
        score: participant.score,
        completedAt: participant.completedAt,
        status: participant.status,
        answers: participant.answers,
      }}
      questions={data.questions}
      rank={rankOf(leaderboard, userId)}
    />
  )
}
