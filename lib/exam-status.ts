import {
  Calendar,
  CheckCircle,
  Clock,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react"

export type ExamStatus = "active" | "upcoming" | "completed" | "inactive"

export type ExamStatusConfig = {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  className: string
  icon: React.ComponentType<{ className?: string }>
}

export const EXAM_STATUS_CONFIG: Record<ExamStatus, ExamStatusConfig> = {
  active: {
    label: "En cours",
    variant: "default",
    className: "bg-gray-200 dark:bg-gray-100 dark:text-gray-500 text-gray-700 ",
    icon: PlayCircle,
  },
  upcoming: {
    label: "À venir",
    variant: "secondary",
    className: "bg-blue-200 dark:bg-blue-100 dark:text-blue-500 text-blue-700 ",
    icon: Clock,
  },
  completed: {
    label: "Terminé",
    variant: "secondary",
    className:
      "bg-green-200 dark:bg-green-100 dark:text-green-500 text-green-700",
    icon: CheckCircle,
  },
  inactive: {
    label: "Désactivé",
    variant: "destructive",
    className: "bg-red-200 dark:bg-red-100 dark:text-red-500 text-red-700 ",
    icon: PauseCircle,
  },
}

export function getExamStatus(exam: {
  isActive: boolean
  startDate: number
  endDate: number
}): ExamStatus {
  const now = Date.now()
  if (!exam.isActive) return "inactive"
  if (now < exam.startDate) return "upcoming"
  if (now > exam.endDate) return "completed"
  return "active"
}
