import {
  CircleCheckBig,
  CircleDashed,
  CirclePause,
  CirclePlay,
  Clock,
} from "lucide-react"
import { ExamStatus, ExamStatusConfig } from "@/types"

export type { ExamStatus, ExamStatusConfig }

export const EXAM_STATUS_CONFIG: Record<ExamStatus, ExamStatusConfig> = {
  preparation: { label: "En préparation", tone: "warning", icon: CircleDashed },
  active: { label: "En cours", tone: "neutral", icon: CirclePlay },
  upcoming: { label: "À venir", tone: "info", icon: Clock },
  completed: { label: "Terminé", tone: "success", icon: CircleCheckBig },
  suspended: { label: "Suspendu", tone: "danger", icon: CirclePause },
}
