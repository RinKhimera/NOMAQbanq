import type { ReactNode } from "react"
import type { QuizImage, QuizQuestion } from "@/components/quiz/runner/types"

export type QuestionCardVariant = "default" | "exam" | "review"

// La forme-pont appartient au moteur de quiz (`runner/types.ts`) ; la carte la
// consomme telle quelle. `explanation`/`references` peuvent être absents et
// arriver en différé via `lazy*`.
export type { QuizQuestion } from "@/components/quiz/runner/types"

/**
 * `muted` : choix ni retenu ni juste, une fois la correction affichée. Une clé
 * retenue n'a pas d'état propre : la réponse reste `selected`, rien n'est
 * corrigé.
 */
export type AnswerOptionState =
  "default" | "selected" | "correct" | "incorrect" | "muted"

export type AnswerOptionProps = {
  option: string
  index: number
  state: AnswerOptionState
  onClick?: () => void
  disabled?: boolean
  compact?: boolean
  /** Mention à droite ; par défaut « Bonne réponse » / « Votre réponse ». */
  statusLabel?: string
}

export type QuestionCardProps = {
  question: QuizQuestion

  /** Correction chargée à la demande, prioritaire sur celle de `question`. */
  lazyExplanation?: string
  lazyReferences?: string[]
  /**
   * Images d'explication chargées à la demande (correction d'examen).
   * Rendues UNIQUEMENT en variante `review`, jamais en passation.
   */
  lazyExplanationImages?: QuizImage[]

  variant?: QuestionCardVariant

  // === Passation (variant="exam") ===
  selectedAnswer?: string | null
  onAnswerSelect?: (answerIndex: number) => void
  disabled?: boolean
  isFlagged?: boolean
  onFlagToggle?: () => void

  // === Correction (variant="review") ===
  userAnswer?: string | null
  /**
   * Verdict enregistré de la réponse, fixé contre la clé du moment : fait
   * foi sur la clé actuelle, comme le score. Absent (quiz public, aperçu),
   * la carte compare la réponse à la clé actuelle.
   */
  userVerdict?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void

  // === Affichage ===
  questionNumber?: number
  /** Nombre de questions de la série, pour « Question 3 / 10 ». */
  totalQuestions?: number
  showImage?: boolean
  showCorrectAnswer?: boolean
  showDomainBadge?: boolean
  showObjectifBadge?: boolean
  /** Pied de carte (navigation de la passation). */
  footer?: ReactNode
  /**
   * Images d'explication dans la correction révélée de `exam`. Admin
   * seulement (fiche, aperçu) : jamais en passation.
   */
  revealExplanationImages?: boolean

  className?: string
}
