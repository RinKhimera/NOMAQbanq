import type { QuestionAnswerBreakdown } from "@/features/analytics/dal"
import type { QuestionDetail, QuestionExamUse } from "@/features/questions/dal"
import { keyReview } from "@/features/questions/key-review"
import { adminSectionOf, finalizedWindow } from "@/lib/exam-phase"

// Module pur, partagé par le détail et `/modifier` d'une question.

/** Examen en cours qui fige la question jusqu'à sa fermeture. */
export type FreezingExam = { title: string; endDate: number }

/** Examen à venir qui figera la question à son ouverture. */
export type UpcomingFreeze = { title: string; startDate: number }

/** Identifiants en minuscules et chiffres : même ordre que dans Postgres. */
const byId = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/**
 * Question figée : l'examen finalisé en cours qui ferme le plus tard la fige
 * (même règle et même départage par identifiant que `updateQuestion`). Sinon,
 * l'examen finalisé à venir qui ouvre le plus tôt annonce le gel. Un examen en
 * préparation ne compte pas.
 */
export const freezeOf = (
  exams: QuestionExamUse[],
  now: number,
): { frozenBy: FreezingExam | null; upcoming: UpcomingFreeze | null } => {
  const windows = exams.flatMap((e) => {
    const window = finalizedWindow(e)
    return window
      ? [
          {
            id: e.id,
            title: e.title,
            section: adminSectionOf(e, now),
            ...window,
          },
        ]
      : []
  })
  const frozenBy =
    windows
      .filter((w) => w.section === "active")
      .sort((a, b) => b.endDate - a.endDate || byId(b, a))
      .map(({ title, endDate }) => ({ title, endDate }))[0] ?? null
  if (frozenBy) return { frozenBy, upcoming: null }
  const upcoming =
    windows
      .filter((w) => w.section === "upcoming")
      .sort((a, b) => a.startDate - b.startDate || byId(a, b))
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
