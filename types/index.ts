import { LucideIcon } from "lucide-react"

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

/**
 * Forme native d'un examen. Reprend la
 * convention `_id` / `_creationTime` de l'ancien `Doc<"exams">` ainsi que les
 * colonnes de la table `exams` (le champ `participants` n'existe plus depuis le
 * schéma V2 normalisé).
 */
export type ExamDoc = {
  _id: string
  _creationTime: number
  title: string
  description?: string
  startDate: number
  endDate: number
  questionIds: string[]
  completionTime: number
  enablePause?: boolean
  pauseDurationMinutes?: number
  isActive: boolean
  createdBy: string
}

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
export type ExamWithoutParticipants = ExamDoc & {
  participantCount: number
}

/**
 * Exam with user's participation status (V2)
 * Used by examen-blanc page to show "already taken" status
 */
export type ExamWithUserParticipation = ExamDoc & {
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
