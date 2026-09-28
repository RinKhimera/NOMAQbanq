import { CircleCheckBig, CirclePause, CirclePlay, Clock } from "lucide-react"
import { ExamStatus, ExamStatusConfig } from "@/types"

export type { ExamStatus, ExamStatusConfig }

export const EXAM_STATUS_CONFIG: Record<ExamStatus, ExamStatusConfig> = {
  active: { label: "En cours", tone: "neutral", icon: CirclePlay },
  upcoming: { label: "À venir", tone: "info", icon: Clock },
  completed: { label: "Terminé", tone: "success", icon: CircleCheckBig },
  inactive: { label: "Désactivé", tone: "danger", icon: CirclePause },
}
