"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Clock,
  CheckCircle2,
  XCircle,
  GraduationCap,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Id } from "@/convex/_generated/dataModel"

interface RecentExam {
  _id: Id<"exams">
  title: string
  startDate: number
  endDate: number
  isCompleted: boolean
  score: number | null
  completedAt: number | null
}

interface RecentActivityFeedProps {
  recentExams: RecentExam[]
  now: number
  isAdmin?: boolean
}

export const RecentActivityFeed = ({
  recentExams,
  now,
  isAdmin,
}: RecentActivityFeedProps) => {
  const completedExams = recentExams.filter(
    (exam) =>
      exam.isCompleted && (isAdmin || now >= exam.endDate)
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Clock className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Activité récente
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Vos derniers examens
            </p>
          </div>
        </div>

        {completedExams.length > 0 && (
          <Link
            href="/dashboard/mock-exam"
            className="flex items-center gap-1 text-sm font-medium text-blue-500 transition-colors hover:text-blue-600"
          >
            Voir tout
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Timeline */}
      <div className="relative space-y-3">
        {completedExams.length > 0 ? (
          completedExams.map((exam, index) => {
            const isPassing = (exam.score ?? 0) >= 60
            const completedDate = exam.completedAt
              ? new Date(exam.completedAt)
              : null

            return (
              <motion.div
                key={exam._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
              >
                <Link href={`/dashboard/mock-exam/${exam._id}/results`}>
                  <div className="group relative flex items-center gap-4 rounded-xl border border-gray-200/50 bg-white/80 p-4 backdrop-blur-sm transition-all duration-300 hover:border-gray-300 hover:shadow-md dark:border-gray-700/50 dark:bg-gray-900/80 dark:hover:border-gray-600">
                    {/* Timeline dot */}
                    <div className="absolute -left-[3px] top-1/2 -translate-y-1/2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isPassing ? "bg-emerald-500" : "bg-red-500"
                        )}
                      />
                    </div>

                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl",
                        isPassing
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-red-100 dark:bg-red-900/30"
                      )}
                    >
                      {isPassing ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <h4 className="truncate font-medium text-gray-900 dark:text-white">
                          {exam.title}
                        </h4>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {completedDate
                          ? formatDistanceToNow(completedDate, {
                              addSuffix: true,
                              locale: fr,
                            })
                          : "Date inconnue"}
                      </p>
                    </div>

                    {/* Score badge */}
                    <div
                      className={cn(
                        "flex h-10 w-16 items-center justify-center rounded-lg font-bold",
                        isPassing
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}
                    >
                      {exam.score}%
                    </div>

                    {/* Hover arrow */}
                    <ChevronRight className="h-5 w-5 text-gray-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                </Link>
              </motion.div>
            )
          })
        ) : (
          <div className="rounded-xl border border-gray-200/50 bg-white/80 p-8 text-center backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="font-medium text-gray-900 dark:text-white">
              Aucun examen complété
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Vos résultats apparaîtront ici après chaque examen
            </p>
            <Link href="/dashboard/mock-exam">
              <button className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600">
                Passer un examen
              </button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  )
}
