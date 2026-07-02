"use client"

import {
  ArrowLeft,
  Ellipsis,
  FileDown,
  FileText,
  ListChecks,
  Pencil,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { sidebarMenuButtonVariants } from "@/components/ui/sidebar"
import type {
  EligibleCandidate,
  ExamAudienceUser,
  ExamQuestionView,
  ExamWithQuestions,
  LeaderboardEntry,
} from "@/features/exams/dal"
import { cn } from "@/lib/utils"
import { ExamDetails } from "./exam-details"
import { ExamQuestionsModal } from "./exam-questions-modal"

interface ExamDetailsClientProps {
  examId: string
  exam: NonNullable<ExamWithQuestions>["exam"]
  questions: ExamQuestionView[]
  leaderboard: LeaderboardEntry[]
  candidates: EligibleCandidate[]
  audience: ExamAudienceUser[]
  currentUserId?: string
}

export function ExamDetailsClient({
  examId,
  exam,
  questions,
  leaderboard,
  candidates,
  audience,
  currentUserId,
}: ExamDetailsClientProps) {
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
            <Link href="/admin/examens">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-blue-600 md:text-xl dark:text-white">
            Détails de l&apos;examen
          </h1>
        </div>

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
                  sidebarMenuButtonVariants({ variant: "link" }),
                  "cursor-pointer focus:hover:bg-red-500/15 focus:hover:text-red-500 dark:focus:hover:bg-red-100 dark:focus:hover:text-red-400",
                )}
              >
                <FileDown className="mr-2 h-4 w-4 focus:hover:text-red-500 dark:focus:hover:text-red-400" />{" "}
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  sidebarMenuButtonVariants({ variant: "link" }),
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
      </div>

      <ExamDetails
        exam={exam}
        leaderboard={leaderboard}
        candidates={candidates}
        audience={audience}
        isAdmin={true}
        currentUserId={currentUserId}
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
