import { eq, inArray, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import {
  type examParticipationStatus,
  examQuestions,
  questions,
} from "@/db/schema"

export const countQuestionsByExam = async (
  examIds: string[],
): Promise<Map<string, number>> => {
  const map = new Map<string, number>()
  for (const [id, c] of await questionCountsByExam(examIds))
    map.set(id, c.total)
  return map
}

/**
 * Taille du jeu de chaque examen et, parmi elles, les questions supprimées
 * depuis leur ajout : la finalisation refuse un jeu qui en contient.
 */
export const questionCountsByExam = async (
  examIds: string[],
): Promise<Map<string, { total: number; deleted: number }>> => {
  const map = new Map<string, { total: number; deleted: number }>()
  if (examIds.length === 0) return map
  const rows = await db
    .select({
      examId: examQuestions.examId,
      total: sql<number>`count(*)`.mapWith(Number),
      deleted:
        sql<number>`count(*) filter (where ${questions.deletedAt} is not null)`.mapWith(
          Number,
        ),
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(inArray(examQuestions.examId, examIds))
    .groupBy(examQuestions.examId)
  for (const r of rows)
    map.set(r.examId, { total: r.total, deleted: r.deleted })
  return map
}

const NOT_FINALIZED = "EXAM_NOT_FINALIZED"

/** Une date d'un examen finalisé (voir `finalizedDates`), en epoch ms. */
export const finalizedDate = (date: Date | null): number => {
  if (!date) throw new Error(NOT_FINALIZED)
  return date.getTime()
}

/** La durée d'un examen finalisé (voir `finalizedDates`), en secondes. */
export const finalizedDuration = (seconds: number | null): number => {
  if (seconds === null) throw new Error(NOT_FINALIZED)
  return seconds
}

/**
 * Dates et durée d'un examen finalisé, en epoch ms (durée en secondes). La
 * contrainte `exams_finalized_complete` les garantit dès la finalisation, et
 * toute participation suppose un examen finalisé (`startExam` refuse les
 * autres) : une ligne qui arrive ici sans elles est un bug, pas un cas métier.
 */
export const finalizedDates = (exam: {
  startDate: Date | null
  endDate: Date | null
  completionTime: number | null
}) => ({
  startDate: finalizedDate(exam.startDate),
  endDate: finalizedDate(exam.endDate),
  completionTime: finalizedDuration(exam.completionTime),
})

type ParticipationStatus = (typeof examParticipationStatus.enumValues)[number]

/** Participation soumise : à la main, ou automatiquement (temps écoulé, fermeture). */
export type SubmittedStatus = Extract<
  ParticipationStatus,
  "completed" | "auto_submitted"
>

/** Forme TypeScript de `SUBMITTED` (`population.ts`). */
export const isSubmitted = (
  status: ParticipationStatus | undefined,
): status is SubmittedStatus =>
  status === "completed" || status === "auto_submitted"

/** Lecture filtrée sur les statuts soumis : un autre statut est un bug. */
export const submittedStatus = (
  status: ParticipationStatus,
): SubmittedStatus => {
  if (status === "in_progress") throw new Error("PARTICIPATION_NOT_SUBMITTED")
  return status
}
