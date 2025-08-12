"use client"

import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Trophy,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { getExamStatus } from "@/lib/exam-status"
import { type ExamStatItem, ExamStatsGrid } from "./_components/ExamStatsGrid"
import ExamStatusBadge from "./exam-status-badge"

interface ExamDetailsProps {
  examId: Id<"exams">
}

export function ExamDetails({ examId }: ExamDetailsProps) {
  const exam = useQuery(api.exams.getExamWithQuestions, { examId })
  const leaderboard = useQuery(api.exams.getExamLeaderboard, { examId })

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

  const statItems: ExamStatItem[] = [
    {
      title: "Participants",
      value: exam.participants.length,
      icon: Users,
      iconClassName:
        "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    },
    {
      title: "Score moyen",
      value:
        exam.participants.length > 0
          ? `${Math.round(
              exam.participants.reduce((sum, p) => sum + p.score, 0) /
                exam.participants.length,
            )}%`
          : "0%",
      icon: Trophy,
      iconClassName:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    },
    {
      title: "Meilleur score",
      value:
        exam.participants.length > 0
          ? `${Math.max(...exam.participants.map((p) => p.score))}%`
          : "0%",
      icon: Trophy,
      iconClassName:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
  ]

  return (
    <div className="space-y-6">
      {/* En-tête de l'examen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-blue-600 dark:text-white">
                {exam.title}
              </CardTitle>
              {exam.description && (
                <CardDescription className="mt-2">
                  {exam.description}
                </CardDescription>
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

      {/* Statistiques */}
      <ExamStatsGrid items={statItems} />

      {/* Classement */}
      {leaderboard && leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600 dark:text-white">
              Classement
            </CardTitle>
            <CardDescription>
              Les participants classés par score décroissant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboard.map((entry, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{entry.user?.name}</p>
                      {entry.user?.username && (
                        <p className="text-muted-foreground text-sm">
                          @{entry.user.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{entry.score}%</p>
                    <p className="text-muted-foreground text-sm">
                      {format(new Date(entry.completedAt), "PPP", {
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions de l'examen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600 dark:text-white">
            Questions de l&apos;examen
          </CardTitle>
          <CardDescription>
            Liste des questions composant cet examen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {exam.questions?.map((question, index) => (
              <div key={question?._id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline">Question {index + 1}</Badge>
                      <Badge variant="badge">{question?.domain}</Badge>
                    </div>
                    <p className="line-clamp-5 text-sm leading-relaxed @lg:line-clamp-3">
                      {question?.question}
                    </p>
                  </div>
                </div>
                <Separator className="my-3" />
                {/* Options de réponse */}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {question?.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                        option === question.correctAnswer
                          ? "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                          : "border-primary/20 bg-muted dark:bg-gray-900"
                      }`}
                    >
                      <Badge
                        variant={
                          option === question.correctAnswer
                            ? "default"
                            : "outline"
                        }
                        className="flex h-6 min-w-[24px] flex-shrink-0 items-center justify-center"
                      >
                        {String.fromCharCode(65 + optionIndex)}
                      </Badge>
                      <span
                        className={`flex-1 ${option === question.correctAnswer ? "font-medium" : ""}`}
                      >
                        {option}
                      </span>
                      {option === question.correctAnswer && (
                        <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
