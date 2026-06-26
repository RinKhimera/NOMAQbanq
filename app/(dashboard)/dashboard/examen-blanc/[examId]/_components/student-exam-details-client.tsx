"use client"

import { ArrowLeft, ChartColumn, ListChecks } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ExamDetails } from "@/app/(admin)/admin/exams/[id]/_components/exam-details"
import { ExamQuestionsModal } from "@/app/(admin)/admin/exams/[id]/_components/exam-questions-modal"
import { Button } from "@/components/ui/button"
import type {
  ExamQuestionView,
  ExamWithQuestions,
  LeaderboardEntry,
} from "@/features/exams/dal"

interface StudentExamDetailsClientProps {
  examId: string
  exam: NonNullable<ExamWithQuestions>["exam"]
  questions: ExamQuestionView[]
  leaderboard: LeaderboardEntry[]
  currentUserId?: string
  showResultsLink: boolean
}

export function StudentExamDetailsClient({
  examId,
  exam,
  questions,
  leaderboard,
  currentUserId,
  showResultsLink,
}: StudentExamDetailsClientProps) {
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false)

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
            <Link href="/dashboard/examen-blanc">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <h1 className="font-display text-lg font-semibold text-blue-600 md:text-xl">
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

          {showResultsLink && (
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              size="sm"
              asChild
            >
              <Link href={`/dashboard/examen-blanc/${examId}/resultats`}>
                <ChartColumn className="mr-2 h-4 w-4" />
                Voir mes résultats
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ExamDetails
        exam={exam}
        leaderboard={leaderboard}
        candidates={[]}
        isAdmin={false}
        currentUserId={currentUserId}
      />

      <ExamQuestionsModal
        questions={questions}
        open={isQuestionsOpen}
        onOpenChange={setIsQuestionsOpen}
      />
    </div>
  )
}
