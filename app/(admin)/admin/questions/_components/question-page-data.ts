import type { QuestionAnswerBreakdown } from "@/features/analytics/dal"
import type { QuestionDetail, QuestionExamUse } from "@/features/questions/dal"
import { keyReview } from "@/features/questions/key-review"
import { finalizedWindow } from "@/lib/exam-phase"

// Module pur, partagé par le détail et `/modifier` d'une question.

/** Examen en cours qui fige la question jusqu'à sa fermeture. */
export type FreezingExam = { title: string; endDate: number }

/** Examen à venir qui figera la question à son ouverture. */
export type UpcomingFreeze = { title: string; startDate: number }

/**
 * Question figée : l'examen finalisé en cours qui ferme le plus tard la fige
 * (même règle que `updateQuestion`). Sinon, l'examen finalisé à venir qui
 * ouvre le plus tôt annonce le gel. Un examen en préparation ne compte pas.
 */
export const freezeOf = (
  exams: QuestionExamUse[],
  now: number,
): { frozenBy: FreezingExam | null; upcoming: UpcomingFreeze | null } => {
  const windows = exams.flatMap((e) => {
    const window = finalizedWindow(e)
    return window ? [{ title: e.title, ...window }] : []
  })
  const frozenBy =
    windows
      .filter((w) => w.startDate <= now && now < w.endDate)
      .sort((a, b) => b.endDate - a.endDate)
      .map(({ title, endDate }) => ({ title, endDate }))[0] ?? null
  if (frozenBy) return { frozenBy, upcoming: null }
  const upcoming =
    windows
      .filter((w) => now < w.startDate)
      .sort((a, b) => a.startDate - b.startDate)
      .map(({ title, startDate }) => ({ title, startDate }))[0] ?? null
  return { frozenBy: null, upcoming }
}

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
