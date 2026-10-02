import { inArray, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { examQuestions } from "@/db/schema"

export const countQuestionsByExam = async (
  examIds: string[],
): Promise<Map<string, number>> => {
  const map = new Map<string, number>()
  if (examIds.length === 0) return map
  const rows = await db
    .select({
      examId: examQuestions.examId,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(examQuestions)
    .where(inArray(examQuestions.examId, examIds))
    .groupBy(examQuestions.examId)
  for (const r of rows) map.set(r.examId, r.n)
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
