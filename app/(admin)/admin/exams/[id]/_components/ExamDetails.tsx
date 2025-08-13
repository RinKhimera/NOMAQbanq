"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar, Clock, FileText } from "lucide-react"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { ExamLeaderboard } from "./ExamLeaderboard"
import { ExamQuestions } from "./ExamQuestions"
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl text-blue-600 dark:text-white">
                {exam.title}
              </CardTitle>
              <ExamStatusBadge status={status} />
            </div>
            {exam.description && (
              <div className="mt-2">
                <Accordion className="w-64" type="single" collapsible>
                  <AccordionItem value="description">
                    <AccordionTrigger className="w-64 text-sm">
                      Afficher la description
                    </AccordionTrigger>
                    <AccordionContent className="w-64">
                      <CardDescription>{exam.description}</CardDescription>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
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

      <ExamQuestions examId={examId} />
    </div>
  )
}
