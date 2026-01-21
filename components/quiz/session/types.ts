import type { Id } from "@/convex/_generated/dataModel"

// Session modes
export type SessionMode = "training" | "exam"

// Accent color theming
export type AccentColor = "emerald" | "blue"

// Session configuration
export interface SessionConfig {
  mode: SessionMode

  // Timer configuration (exam only)
  showTimer?: boolean
  timeRemaining?: number // milliseconds
  isTimeRunningOut?: boolean // < 10 min
  isTimeCritical?: boolean // < 5 min
  onTimeUp?: () => void

  // Toolbar configuration
  showCalculator?: boolean
  showLabValues?: boolean

  // Navigation configuration
  showFlagging?: boolean
  showKeyboardShortcuts?: boolean

  // Theming
  accentColor?: AccentColor
}

// Question types
export interface SessionQuestion {
  _id: Id<"questions">
  question: string
  options: string[]
  correctAnswer: string
  domain: string
  objectifCMC: string
  explanation: string
  references?: string[]
  images?: Array<{
    url: string
    storagePath: string
    order: number
  }>
}

export interface SessionAnswer {
  selectedAnswer: string
  isCorrect?: boolean
}

// Component props interfaces

export interface SessionHeaderProps {
  config: SessionConfig
  currentIndex: number
  totalQuestions: number
  answeredCount: number
  onFinish: () => void

  // Branding
  title: string
  icon: React.ReactNode
  backUrl: string

  // Exam-specific actions (optional)
  examActions?: {
    onTakePause?: () => void
    canTakePause?: boolean
  }
}

export interface QuestionNavigatorProps {
  questions: Array<{ _id: { toString(): string } }>
  answers: Record<string, SessionAnswer>
  flaggedQuestions: Set<string>
  currentIndex: number
  onNavigate: (index: number) => void
  variant?: "desktop" | "mobile"

  // Exam-specific locking
  isQuestionLocked?: (index: number) => boolean

  // Theming
  accentColor?: AccentColor
}

export interface SessionToolbarProps {
  showCalculator?: boolean
  onOpenCalculator?: () => void
  showLabValues?: boolean
  onOpenLabValues?: () => void
  showScrollTop?: boolean
}

export interface SessionNavigationProps {
  currentIndex: number
  totalQuestions: number
  isFlagged: boolean
  onPrevious: () => void
  onNext: () => void
  onToggleFlag: () => void

  // Exam-specific locking
  isPreviousLocked?: boolean
  isNextLocked?: boolean

  // Theming
  accentColor?: AccentColor
}

export interface FinishDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  answeredCount: number
  totalQuestions: number
  flaggedCount: number
  isSubmitting: boolean
  onConfirm: () => void

  // Mode-specific
  mode: SessionMode
  timeRemaining?: number

  // Text customization
  confirmText?: string
  cancelText?: string
}

// Accent color configuration
export const accentColors = {
  emerald: {
    gradient: "from-emerald-600 to-teal-600",
    hoverGradient: "from-emerald-700 to-teal-700",
    ring: "ring-emerald-500",
    ringOffset: "ring-offset-2",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    answered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    unanswered: "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
    flagFilter: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  blue: {
    gradient: "from-blue-600 to-indigo-600",
    hoverGradient: "from-blue-700 to-indigo-700",
    ring: "ring-blue-500",
    ringOffset: "ring-offset-2",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    answered: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    unanswered: "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
    flagFilter: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
} as const
