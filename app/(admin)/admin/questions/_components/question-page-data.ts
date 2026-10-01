import type { QuestionAnswerBreakdown } from "@/features/analytics/dal"
import type { QuestionDetail, QuestionExamUse } from "@/features/questions/dal"
import { keyReview } from "@/features/questions/key-review"
import { isOpen } from "@/lib/exam-phase"

// Module pur, partagé par le détail et `/modifier` d'une question.

/** Choix figés : l'examen ouvert qui ferme le plus tard les tient verrouillés. */
export const lockingExamOf = (
  exams: QuestionExamUse[],
  now: number,
): QuestionExamUse | null =>
  exams
    .filter((e) => isOpen(e, now))
    .sort((a, b) => b.endDate - a.endDate)[0] ?? null

/** Clé à vérifier, clé confirmée en vigueur ou tombée. */
export const reviewOf = (
  question: QuestionDetail,
  breakdown: QuestionAnswerBreakdown,
) =>
  keyReview({
    answerCount: breakdown.answerCount,
    keySuspect: breakdown.keySuspect,
    confirmation: question.keyConfirmation,
  })
