import type { QuizImage, QuizQuestion } from "@/components/quiz/runner/types"

// ===== Variant Types =====
export type QuestionCardVariant = "default" | "exam" | "review"

// ===== Question shape =====
// La forme-pont appartient au moteur de quiz (`runner/types.ts`) ; la carte la
// consomme telle quelle. `explanation`/`references` peuvent être absents et
// arriver en différé via `lazy*`.
export type { QuizQuestion } from "@/components/quiz/runner/types"

// ===== Action Types =====
export type QuestionActionType =
  "view" | "edit" | "delete" | "add" | "remove" | "permanent-delete"

export type ActionConfig = {
  type: QuestionActionType
  label: string
  icon: React.ReactNode
  variant?: "default" | "destructive"
  onClick: () => void
}

// ===== Answer Option Types =====
export type AnswerState =
  | "default"
  | "selected"
  | "correct"
  | "incorrect"
  | "user-correct"
  | "user-incorrect"

export type AnswerOptionProps = {
  option: string
  index: number
  state: AnswerState
  onClick?: () => void
  disabled?: boolean
  showCheckIcon?: boolean
  showXIcon?: boolean
  compact?: boolean
}

// ===== Main Component Props =====
export type QuestionCardProps = {
  /** The question data. explanation/references are optional and lazy-loaded
   *  via getQuestionExplanations — pass them explicitly on the question
   *  object or via the `lazyExplanation` prop below. */
  question: QuizQuestion

  /** Lazy-loaded explanation/references. If provided, these take priority
   *  over `question.explanation` and `question.references`. Used by the
   *  review pages that fetch explanations on expand via a separate query. */
  lazyExplanation?: string
  lazyReferences?: string[]
  /** Images d'explication lazy-chargées (correction examen via
   *  getExamQuestionExplanations). Prioritaires sur `question.explanationImages`.
   *  Rendues UNIQUEMENT en variant "review" (jamais en passation). */
  lazyExplanationImages?: QuizImage[]

  /** Display variant - determines overall layout and behavior */
  variant?: QuestionCardVariant

  // === Interactive mode props (variant="exam") ===
  /** Currently selected answer */
  selectedAnswer?: string | null
  /** Callback when user selects an answer */
  onAnswerSelect?: (answerIndex: number) => void
  /** Disable answer selection */
  disabled?: boolean
  /** Whether the question is flagged for review */
  isFlagged?: boolean
  /** Callback when user toggles flag status */
  onFlagToggle?: () => void

  // === Review mode props (variant="review") ===
  /** User's submitted answer for review */
  userAnswer?: string | null
  /** Whether the question review is expanded */
  isExpanded?: boolean
  /** Toggle expand/collapse callback */
  onToggleExpand?: () => void
  /** Whether the question was flagged during exam (for review display) */
  wasFlagged?: boolean

  // === Display options ===
  /** Question number (1-indexed) */
  questionNumber?: number
  /** Show question image if available */
  showImage?: boolean
  /** Show correct answer highlighting */
  showCorrectAnswer?: boolean
  /** Show domain badge */
  showDomainBadge?: boolean
  /** Show ObjectifCMC badge */
  showObjectifBadge?: boolean
  /** Truncate question text (for compact displays) */
  truncateQuestion?: boolean

  // === Admin actions ===
  /** Action buttons configuration */
  actions?: ActionConfig[]

  // === Styling ===
  /** Additional CSS classes */
  className?: string
}

// ===== Sub-component Props =====
export type QuestionHeaderProps = {
  question: QuizQuestion
  questionNumber?: number
  showDomainBadge?: boolean
  showObjectifBadge?: boolean
  actions?: ActionConfig[]
}

export type QuestionContentProps = {
  question: QuizQuestion
  showImage?: boolean
  truncate?: boolean
}

export type QuestionExplanationProps = {
  explanation: string
  references?: string[]
}
