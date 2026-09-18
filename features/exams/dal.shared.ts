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
