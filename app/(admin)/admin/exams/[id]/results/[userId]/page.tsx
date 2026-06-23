import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { ParticipantExamResultsView } from "@/components/quiz/results/participant-exam-results-view"
import { getParticipantExamResults } from "@/features/exams/dal"
import { ParticipantResultsError } from "./_components/participant-results-error"

export default async function AdminParticipantResultsPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id, userId } = await params
  const data = await getParticipantExamResults(id, userId)
  if (!data) notFound()

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

  return (
    <ParticipantExamResultsView
      examTitle={data.exam.title}
      questions={data.questions}
      answers={data.participant.answers}
      score={data.participant.score}
      backHref={`/admin/exams/${id}`}
      backLabel="Retour au classement"
      backIcon={<ArrowLeft className="h-4 w-4" />}
      participantUser={data.participantUser}
    />
  )
}
