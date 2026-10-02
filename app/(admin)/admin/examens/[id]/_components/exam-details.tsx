import { Calendar, Clock, FileText } from "lucide-react"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { LeaderboardEntry } from "@/features/exams/dal"
import type { ExamStatus } from "@/lib/exam-status"
import { formatDeadline } from "@/lib/format"
import { ExamLeaderboard } from "./exam-leaderboard"
import { ExamSectionStats } from "./exam-section-stats"

type ExamMeta = {
  startDate: number | null
  endDate: number | null
  id: string
  title: string
  description: string | null
  questionCount: number
  audienceType: "subscribers" | "restricted"
}

interface ExamDetailsProps {
  exam: ExamMeta
  leaderboard: LeaderboardEntry[]
  isAdmin?: boolean
  currentUserId?: string
  /** Phase calculée par l'appelant : l'admin voit aussi la préparation. */
  status: ExamStatus
}

export function ExamDetails({
  exam,
  leaderboard,
  isAdmin = false,
  currentUserId,
  status,
}: ExamDetailsProps) {
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
                  {exam.startDate === null
                    ? "À définir"
                    : formatDeadline(exam.startDate)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Date de fin</p>
                <p className="text-muted-foreground text-sm">
                  {exam.endDate === null
                    ? "À définir"
                    : formatDeadline(exam.endDate)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Questions</p>
                <p className="text-muted-foreground text-sm">
                  {exam.questionCount} questions
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExamSectionStats leaderboard={leaderboard} />

      <ExamLeaderboard
        examId={exam.id}
        leaderboard={leaderboard}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </div>
  )
}
