"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar, Clock, FileText, Users } from "lucide-react"
import { motion } from "motion/react"
import { Id } from "@/convex/_generated/dataModel"
import { getExamStatus } from "@/lib/exam-status"
import { ExamWithoutParticipants } from "@/types"
import { ExamActions } from "./exam-actions"
import ExamStatusBadge from "./exam-status-badge"

interface ExamCardProps {
  exam: ExamWithoutParticipants
  onView?: (examId: Id<"exams">) => void
  onDeactivate: (exam: ExamWithoutParticipants) => void
  onReactivate: (examId: Id<"exams">) => void
  onEdit: (exam: ExamWithoutParticipants) => void
  onDelete: (exam: ExamWithoutParticipants) => void
}

export function ExamCard({
  exam,
  onView,
  onDeactivate,
  onReactivate,
  onEdit,
  onDelete,
}: ExamCardProps) {
  const status = getExamStatus(exam)

  const handleCardClick = () => {
    if (onView) {
      onView(exam._id)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      onClick={handleCardClick}
    >
      {/* Header: Badge + Actions */}
      <div className="mb-4 flex items-start justify-between">
        <ExamStatusBadge status={status} />
        <div onClick={(e) => e.stopPropagation()}>
          <ExamActions
            exam={exam}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Title & Description */}
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {exam.title}
        </h3>
        {exam.description && (
          <p
            className="mt-1.5 text-sm text-slate-500 dark:text-slate-400"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {exam.description}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatItem
          icon={<Calendar className="h-4 w-4" />}
          label="Début"
          value={format(new Date(exam.startDate), "d MMM yyyy", { locale: fr })}
        />
        <StatItem
          icon={<Clock className="h-4 w-4" />}
          label="Fin"
          value={format(new Date(exam.endDate), "d MMM yyyy", { locale: fr })}
        />
        <StatItem
          icon={<FileText className="h-4 w-4" />}
          label="Questions"
          value={exam.questionIds.length.toString()}
        />
        <StatItem
          icon={<Users className="h-4 w-4" />}
          label="Participants"
          value={exam.participantCount.toString()}
        />
      </div>
    </motion.div>
  )
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {value}
        </p>
      </div>
    </div>
  )
}
