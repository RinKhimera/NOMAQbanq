import { LucideIcon } from "lucide-react"
import { Doc } from "@/convex/_generated/dataModel"

// ===== Domain Types =====
export interface Domain {
  id: string
  title: string
  description: string
  icon: string
  questionsCount: number
  slug: string
}

// ===== Testimonial Types =====
export interface Testimonial {
  id: string
  name: string
  role: string
  avatar: string
  content: string
  rating: number
}

// ===== Exam Types =====
export type ExamStatus = "active" | "upcoming" | "completed" | "inactive"

export type ExamStatusConfig = {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  className: string
  icon: React.ComponentType<{ className?: string }>
}

export type ExamStatItem = {
  title: string
  value: string | number
  icon: LucideIcon
  iconClassName?: string
}

/**
 * Exam type without embedded participants (V2 normalized schema)
 * Use this for admin list views and other places that don't need participant details
 */
export type ExamWithoutParticipants = Omit<Doc<"exams">, "participants"> & {
  participantCount: number
}

/**
 * Exam with user's participation status (V2)
 * Used by examen-blanc page to show "already taken" status
 */
export type ExamWithUserParticipation = Omit<Doc<"exams">, "participants"> & {
  userHasTaken: boolean
  userParticipation: {
    status: "in_progress" | "completed" | "auto_submitted" | undefined
    score: number
    completedAt: number
  } | null
}

// ===== Navigation Types =====
export interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

export interface NavigationConfig {
  navMain: NavItem[]
  navSecondary: NavItem[]
}
