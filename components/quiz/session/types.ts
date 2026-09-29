import type { QuizMode } from "@/components/quiz/runner/types"
import type { TimeZone } from "@/lib/attempt-clock"

export type SessionKind = QuizMode["kind"]

export type SessionHeaderProps = {
  /** Titre de la série ou de l'examen : le `h1` de la page de passation. */
  title: string
  kind: SessionKind
  /** « Mode tuteur », « Mode test », « Chronométré ». */
  modeLabel?: string
  currentIndex: number
  totalQuestions: number
  answeredCount: number
  /** Chrono déjà formaté et son palier ; absent = pas de chrono. */
  timer?: { label: string; zone: TimeZone }
  /** Présent seulement quand la pause unique est encore disponible. */
  onPause?: () => void
  /** Absent : pas de bouton « Terminer » (évaluation gratuite). */
  onFinish?: () => void
  /** `false` dans une démo intégrée à une page (vitrine). */
  sticky?: boolean
  /** `p` quand la barre illustre une page qui porte déjà son `h1`. */
  titleAs?: "h1" | "p"
}

export type FinishDialogProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  answeredCount: number
  totalQuestions: number
  flaggedCount: number
  isSubmitting: boolean
  onConfirm: () => void
  kind: SessionKind
}
