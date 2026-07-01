import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import {
  SessionResults,
  SessionResultsHeader,
} from "@/components/quiz/results/session-results"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import { loadExamQuestionExplanations } from "@/features/exams/actions"
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

  // Map DAL output → QuizQuestion[]
  const questions: QuizQuestion[] = data.questions.map((q) => ({
    _id: q._id,
    question: q.question,
    options: q.options,
    images: q.images ?? [],
    domain: q.domain ?? undefined,
    objectifCMC: q.objectifCMC ?? undefined,
    correctAnswer: q.correctAnswer,
  }))

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

  const score = data.participant.score

  // Compute summary counts
  let correct = 0
  let incorrect = 0
  const answeredIds = new Set(
    data.participant.answers
      .filter((a) => a.selectedAnswer !== null && a.selectedAnswer !== "")
      .map((a) => a.questionId),
  )
  for (const a of data.participant.answers) {
    if (a.selectedAnswer === null || a.selectedAnswer === "") continue
    if (a.isCorrect) correct++
    else incorrect++
  }
  const unanswered = questions.length - answeredIds.size

  // Admin participant info
  const participant = data.participantUser
    ? {
        name: data.participantUser.name ?? "",
        email: data.participantUser.email,
        image: data.participantUser.image,
      }
    : undefined

  return (
    <>
      <SessionResultsHeader
        title="Résultats de l'examen"
        subtitle={data.exam.title}
        score={score}
        backHref={`/admin/exams/${id}`}
        backLabel="Retour au classement"
        backIcon={<ArrowLeft className="h-4 w-4" />}
      />
      <SessionResults
        accent="blue"
        summary={{ score, correct, incorrect, unanswered }}
        questions={questions}
        answers={answers}
        loadExplanations={loadExamQuestionExplanations}
        participant={participant}
      />
    </>
  )
}
