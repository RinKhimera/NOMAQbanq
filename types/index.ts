import { LucideIcon } from "lucide-react"
import type { StatusTone } from "@/components/shared/status-pill"

// ===== Testimonial Types =====
export interface Testimonial {
  id: string
  name: string
  role: string
  content: string
  rating: number
}

// ===== Exam Types =====
export type ExamStatus =
  "preparation" | "active" | "upcoming" | "completed" | "inactive"

export type ExamStatusConfig = {
  label: string
  tone: StatusTone
  icon: LucideIcon
}
