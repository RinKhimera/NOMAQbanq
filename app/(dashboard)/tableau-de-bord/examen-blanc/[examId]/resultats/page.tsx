import { CircleX, House } from "lucide-react"
import Link from "next/link"
import {
  SessionResults,
  SessionResultsHeader,
} from "@/components/quiz/results/session-results"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import { Button } from "@/components/ui/button"
import { loadExamQuestionExplanations } from "@/features/exams/actions"
import { getParticipantExamResults } from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"

export default async function MockExamResultsPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = await params
  const session = await getCurrentSession()
  const userId = session?.user?.id

  // `getParticipantExamResults` (non-admin) ne renvoie un succès qu'après la fin
  // de l'examen ET pour ses propres résultats complétés ; sinon `null`.
  const data = userId ? await getParticipantExamResults(examId, userId) : null

  if (!data || "error" in data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        <div className="text-center">
          <CircleX className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
            Résultats non disponibles
          </h2>
          <p className="mb-4 max-w-md text-gray-600 dark:text-gray-400">
            Les résultats de cet examen ne sont pas encore disponibles.
          </p>
          <Button asChild>
            <Link href="/tableau-de-bord/examen-blanc">Retour aux examens</Link>
          </Button>
        </div>
      </div>
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

  // Map DAL answers → AnswersMap (sparse-safe: absent key == unanswered)
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

  // Compute summary counts from actual data (sparse-safe)
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

  return (
    <>
      <SessionResultsHeader
        title="Résultats de l'examen"
        subtitle={data.exam.title}
        score={score}
        backHref="/tableau-de-bord/examen-blanc"
        backLabel="Tableau de bord"
        backIcon={<House className="h-4 w-4" />}
      />
      <SessionResults
        accent="blue"
        summary={{ score, correct, incorrect, unanswered }}
        questions={questions}
        answers={answers}
        loadExplanations={loadExamQuestionExplanations}
      />
    </>
  )
}
