import { LucideIcon } from "lucide-react"

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
