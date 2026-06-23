import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getExamLeaderboard,
  getExamSession,
  getExamWithQuestions,
} from "@/features/exams/dal"
import { hasAccess } from "@/features/payments/dal"
import { getCurrentSession } from "@/lib/dal"
import { StudentExamDetailsClient } from "./_components/student-exam-details-client"

// Hors composant : isole l'horloge (impure) du corps de rendu.
const isExamClosed = (endDateMs: number) => endDateMs < Date.now()

export default async function MockExamDetailsPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = await params
  const data = await getExamWithQuestions(examId)
  if (!data) notFound()

  const session = await getCurrentSession()
  const isAdmin = session?.user?.role === "admin"
  const isClosed = isExamClosed(data.exam.endDate)
  const examAccess = isAdmin || (await hasAccess("exam"))

  // Non-admins : accès aux détails uniquement si l'examen est fermé ET accès actif.
  if (!isAdmin && (!isClosed || !examAccess)) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
        <div className="flex items-center gap-3 md:gap-4">
          <Button
            className="hover:text-blue-700 dark:hover:text-white"
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/dashboard/examen-blanc">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="font-display mb-2 text-lg font-semibold">
              Accès non autorisé
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md text-center">
              {!examAccess
                ? "Vous devez avoir un accès exam actif pour accéder à cet examen."
                : "Les résultats de cet examen ne sont pas encore disponibles."}
            </p>
            <Button asChild>
              <Link href="/dashboard/examen-blanc">Retour aux examens</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [leaderboard, examSession] = await Promise.all([
    getExamLeaderboard(examId),
    getExamSession(examId),
  ])
  const hasCompleted =
    examSession?.status === "completed" ||
    examSession?.status === "auto_submitted"

  return (
    <StudentExamDetailsClient
      examId={examId}
      exam={data.exam}
      questions={data.questions}
      leaderboard={leaderboard}
      currentUserId={session?.user?.id}
      showResultsLink={Boolean(hasCompleted) && (isAdmin || isClosed)}
    />
  )
}
