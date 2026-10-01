"use client"

import { Ellipsis, FileDown, FileText, ListChecks, Pencil } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ReopenExamButton } from "@/components/admin/reopen-exam-button"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
  AdminExam,
  EligibleCandidate,
  ExamAudienceUser,
  LeaderboardEntry,
} from "@/features/exams/dal"
import { useClock } from "@/hooks/use-clock"
import { cn } from "@/lib/utils"
import { ExamDetails } from "./exam-details"
import { ExamQuestionsModal } from "./exam-questions-modal"

interface ExamDetailsClientProps {
  examId: string
  exam: AdminExam["exam"]
  questions: QuizQuestion[]
  leaderboard: LeaderboardEntry[]
  candidates: EligibleCandidate[]
  audience: ExamAudienceUser[]
  currentUserId?: string
  /** Horloge serveur du rendu : la phase de l'examen s'en déduit. */
  initialNow: number
}

export function ExamDetailsClient({
  examId,
  exam,
  questions,
  leaderboard,
  candidates,
  audience,
  currentUserId,
  initialNow,
}: ExamDetailsClientProps) {
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false)
  const now = useClock(initialNow)

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <PageIntro
        backHref="/admin/examens"
        title="Détails de l'examen"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-blue-600 text-white max-[500px]:w-full max-[500px]:justify-start"
              asChild
              size="sm"
              variant="none"
            >
              <Link href={`/admin/examens/modifier/${examId}`}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier l&apos;examen
              </Link>
            </Button>

            <ReopenExamButton
              exam={{
                id: examId,
                endDate: exam.endDate,
                finalizedAt: exam.finalizedAt,
              }}
              now={now}
              className="max-[500px]:w-full max-[500px]:justify-start"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 hover:text-blue-700 max-[500px]:w-full max-[500px]:justify-start dark:hover:text-white"
                >
                  <Ellipsis className="h-4 w-4" /> Exporter sous un format
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-card w-full" align="start">
                <DropdownMenuLabel>Exporter</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={cn(
                    "cursor-pointer focus:hover:bg-red-500/15 focus:hover:text-red-500 dark:focus:hover:bg-red-100 dark:focus:hover:text-red-400",
                  )}
                >
                  <FileDown className="mr-2 h-4 w-4 focus:hover:text-red-500 dark:focus:hover:text-red-400" />{" "}
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "cursor-pointer focus:hover:bg-green-500/15 focus:hover:text-green-500 dark:focus:hover:bg-green-100 dark:focus:hover:text-green-400",
                  )}
                >
                  <FileText className="mr-2 h-4 w-4 focus:hover:text-green-500 dark:focus:hover:text-green-400" />{" "}
                  CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              className="hover:text-blue-700 max-[500px]:w-full max-[500px]:justify-start dark:hover:text-white"
              size="sm"
              variant="outline"
              onClick={() => setIsQuestionsOpen(true)}
            >
              <ListChecks className="mr-2 h-4 w-4" /> Voir toutes les questions
            </Button>
          </div>
        }
      />

      <ExamDetails
        exam={exam}
        leaderboard={leaderboard}
        candidates={candidates}
        audience={audience}
        isAdmin={true}
        currentUserId={currentUserId}
        now={now}
      />

      <ExamQuestionsModal
        questions={questions}
        open={isQuestionsOpen}
        onOpenChange={setIsQuestionsOpen}
        enableDetails={true}
      />
    </div>
  )
}
