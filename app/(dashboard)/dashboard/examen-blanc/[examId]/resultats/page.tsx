import { CircleX, House } from "lucide-react"
import Link from "next/link"
import { ParticipantExamResultsView } from "@/components/quiz/results/participant-exam-results-view"
import { Button } from "@/components/ui/button"
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
            <Link href="/dashboard/examen-blanc">Retour aux examens</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ParticipantExamResultsView
      examTitle={data.exam.title}
      questions={data.questions}
      answers={data.participant.answers}
      score={data.participant.score}
      backHref="/dashboard/examen-blanc"
      backLabel="Tableau de bord"
      backIcon={<House className="h-4 w-4" />}
    />
  )
}
