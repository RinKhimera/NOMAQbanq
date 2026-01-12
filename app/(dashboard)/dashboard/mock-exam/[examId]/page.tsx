"use client"

import { useQuery } from "convex/react"
import { ArrowLeft, BarChart3, ListChecks } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { ExamDetails } from "@/app/(admin)/admin/exams/[id]/_components/exam-details"
import { ExamQuestionsModal } from "@/app/(admin)/admin/exams/[id]/_components/exam-questions-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useCurrentUser } from "@/hooks/useCurrentUser"

export default function MockExamDetailsPage() {
  const params = useParams()
  const examId = params.examId as Id<"exams">
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false)
  const [now] = useState(() => Date.now())

  const { currentUser, isLoading: userLoading } = useCurrentUser()
  const exam = useQuery(api.exams.getExamWithQuestions, { examId })

  if (userLoading || !exam) {
    return (
      <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  // Vérifier l'accès et rediriger si non autorisé
  if (currentUser && currentUser.role !== "admin") {
    const isExamClosed = exam.endDate < now
    const isAllowed = exam.allowedParticipants.includes(currentUser._id)

    // Les users ne peuvent accéder que si l'exam est fermé ET ils sont dans allowedParticipants
    if (!isExamClosed || !isAllowed) {
      return (
        <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <Button
              className="hover:text-blue-700 dark:hover:text-white"
              variant="outline"
              size="sm"
              asChild
            >
              <Link href="/dashboard/mock-exam">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Link>
            </Button>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="mb-2 text-lg font-semibold">Accès non autorisé</h3>
              <p className="text-muted-foreground mb-4 max-w-md text-center">
                {!isAllowed
                  ? "Vous n'êtes pas autorisé à accéder à cet examen."
                  : "Les résultats de cet examen ne sont pas encore disponibles."}
              </p>
              <Button asChild>
                <Link href="/dashboard/mock-exam">Retour aux examens</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <Button
            className="hover:text-blue-700 dark:hover:text-white"
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/dashboard/mock-exam">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-blue-600 md:text-xl">
            Détails de l&apos;examen
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="hover:text-blue-700 max-[500px]:w-full max-[500px]:justify-start dark:hover:text-white"
            size="sm"
            variant="outline"
            onClick={() => setIsQuestionsOpen(true)}
          >
            <ListChecks className="mr-2 h-4 w-4" /> Voir toutes les questions
          </Button>

          {currentUser && (() => {
            // Vérifier si l'utilisateur a complété l'examen
            const hasCompleted = (exam.participants ?? []).some(
              (p) => p.userId === currentUser._id && p.status === "completed"
            )
            // Les non-admins ne peuvent voir les résultats qu'après la fin de l'examen
            const canViewResults =
              currentUser.role === "admin" || now >= exam.endDate

            return (
              hasCompleted &&
              canViewResults && (
                <Button
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  size="sm"
                  asChild
                >
                  <Link
                    href={`/dashboard/mock-exam/${examId}/results/${currentUser._id}`}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Voir mes résultats
                  </Link>
                </Button>
              )
            )
          })()}
        </div>
      </div>

      <ExamDetails
        examId={examId}
        isAdmin={false}
        currentUserId={currentUser?._id}
      />

      <ExamQuestionsModal
        examId={examId}
        open={isQuestionsOpen}
        onOpenChange={setIsQuestionsOpen}
      />
    </div>
  )
}
