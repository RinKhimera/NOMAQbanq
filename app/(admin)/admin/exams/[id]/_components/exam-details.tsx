"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar, Clock, FileText } from "lucide-react"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { getExamStatus } from "@/lib/exam-status"
import { ExamLeaderboard } from "./exam-leaderboard"
import { ExamSectionStats } from "./exam-section-stats"

export function ExamDetails({ examId }: { examId: Id<"exams"> }) {
  const exam = useQuery(api.exams.getExamWithQuestions, { examId })

  if (!exam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chargement...</CardTitle>
        </CardHeader>
      </Card>
    )
  }
  const status = getExamStatus(exam)

  return (
    <div className="space-y-6">
      {/* En-tête de l'examen */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-2xl text-blue-600 dark:text-white">
                {exam.title}
              </CardTitle>
              {exam.description && (
                <CardDescription>{exam.description}</CardDescription>
              )}
            </div>
            <ExamStatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-start gap-2">
              <Calendar className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Date de début</p>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(exam.startDate), "PPP à HH:mm", {
                    locale: fr,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Date de fin</p>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(exam.endDate), "PPP à HH:mm", {
                    locale: fr,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Questions</p>
                <p className="text-muted-foreground text-sm">
                  {exam.questionIds.length} questions
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExamSectionStats exam={exam} />

      <ExamLeaderboard examId={examId} />
    </div>
  )
}
