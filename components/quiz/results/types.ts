// Types for results question navigation

export type ResultAccentColor = "blue" | "emerald"

export interface QuestionResultItem {
  isCorrect: boolean
  isAnswered: boolean
}

export interface ResultsNavigatorProps {
  /** Array of question results with correctness info */
  questionResults: QuestionResultItem[]
  /** Callback when navigating to a question */
  onNavigateToQuestion: (index: number) => void
  /** Display variant */
  variant: "desktop" | "mobile"
  /** Position for mobile FAB (default: right) */
  position?: "left" | "right"
  /** Accent color theme */
  accentColor?: ResultAccentColor
  /** Show tips section */
  showTips?: boolean
}

// Color configuration for results
export const resultColors = {
  blue: {
    // FAB button - complete class string for Tailwind purging
    fabButton: "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700",
    correct: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50",
    incorrect: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50",
    unanswered: "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
    legendCorrect: "bg-green-100 dark:bg-green-900/40",
    legendIncorrect: "bg-red-100 dark:bg-red-900/40",
    legendUnanswered: "bg-gray-100 dark:bg-gray-800",
    tipBg: "bg-blue-50/80 dark:bg-blue-900/20",
    accentText: "text-blue-600 dark:text-blue-400",
  },
  emerald: {
    // FAB button - complete class string for Tailwind purging
    fabButton: "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700",
    correct: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50",
    incorrect: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50",
    unanswered: "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
    legendCorrect: "bg-emerald-100 dark:bg-emerald-900/40",
    legendIncorrect: "bg-red-100 dark:bg-red-900/40",
    legendUnanswered: "bg-gray-100 dark:bg-gray-800",
    tipBg: "bg-emerald-50/80 dark:bg-emerald-900/20",
    accentText: "text-emerald-600 dark:text-emerald-400",
  },
} as const
