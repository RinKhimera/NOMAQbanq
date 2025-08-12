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
  className?: string
  icon: React.ComponentType<{ className?: string }>
}

export const EXAM_STATUS_CONFIG: Record<ExamStatus, ExamStatusConfig> = {
  active: {
    label: "En cours",
    variant: "default",
    className: "bg-green-500 hover:bg-green-600 text-white border-green-600",
    icon: PlayCircle,
  },
  upcoming: {
    label: "À venir",
    variant: "secondary",
    className: "bg-blue-500 hover:bg-blue-600 text-white border-blue-600",
    icon: Clock,
  },
  completed: {
    label: "Terminé",
    variant: "secondary",
    className: "bg-gray-500 hover:bg-gray-600 text-white border-gray-600",
    icon: CheckCircle,
  },
  inactive: {
    label: "Désactivé",
    variant: "destructive",
    className: "bg-red-500 hover:bg-red-600 text-white border-red-600",
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
