import { BookOpen } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { SessionResults } from "@/components/quiz/results/session-results"
import type { AnswersMap } from "@/components/quiz/runner/types"
import { ErrorState } from "@/components/shared/error-state"
import { Button } from "@/components/ui/button"
import { getMyExamPercentiles } from "@/features/analytics/dal"
import { loadExamQuestionExplanations } from "@/features/exams/actions"
import { getParticipantExamResults } from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { formatMediumDate } from "@/lib/format"

export const metadata: Metadata = { title: "Résultats de l'examen" }

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
  const [data, percentiles] = await Promise.all([
    userId ? getParticipantExamResults(examId, userId) : null,
    getMyExamPercentiles(),
  ])

  if (data && "error" in data && data.error === "ACCESS_REQUIRED") {
    return (
      <ErrorState
        title="Accès requis pour la correction"
        description="Votre score reste affiché dans la liste des examens. La correction demande un accès Examens actif."
        actions={
          <>
            <Button asChild>
              <Link href="/tarifs">Prolonger l&apos;accès</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tableau-de-bord/examen-blanc">Examens blancs</Link>
            </Button>
          </>
        }
      />
    )
  }

  if (!data || "error" in data) {
    return (
      <ErrorState
        title="Résultats non disponibles"
        description="Les résultats de cet examen sont publiés à sa fermeture."
        actions={
          <Button asChild variant="outline">
            <Link href="/tableau-de-bord/examen-blanc">Examens blancs</Link>
          </Button>
        }
      />
    )
  }

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
  const flaggedIds = data.participant.answers
    .filter((a) => a.isFlagged)
    .map((a) => a.questionId)

  return (
    <SessionResults
      kind="exam"
      // `null` = score retenu par la DAL, jamais transmis au client.
      score={data.participant.score}
      questions={data.questions}
      answers={answers}
      flaggedIds={flaggedIds}
      loadExplanations={loadExamQuestionExplanations}
      percentile={percentiles[examId] ?? null}
      eyebrow={`${data.exam.title} · fermé le ${formatMediumDate(data.exam.endDate)}`}
      actions={
        <>
          <Button asChild className="max-md:h-11">
            <Link href="/tableau-de-bord/entrainement">
              <BookOpen aria-hidden />
              Réviser en série
            </Link>
          </Button>
          <Button asChild variant="outline" className="max-md:h-11">
            <Link href="/tableau-de-bord">Ma progression</Link>
          </Button>
        </>
      }
      backHref="/tableau-de-bord/examen-blanc"
      backLabel="Examens blancs"
    />
  )
}
