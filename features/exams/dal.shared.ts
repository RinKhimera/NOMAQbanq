import { and, asc, eq, inArray, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { examQuestions, questionImages } from "@/db/schema"
import { cdnUrl } from "@/lib/cdn"

// ============================================
// Images (forme « pont » partagée avec training)
// ============================================

export type ExamImageView = {
  url: string
  storagePath: string
  order: number
}

export const groupImages = (
  rows: { questionId: string; storagePath: string; position: number }[],
): Map<string, ExamImageView[]> => {
  const map = new Map<string, ExamImageView[]>()
  for (const img of rows) {
    const list = map.get(img.questionId) ?? []
    list.push({
      url: cdnUrl(img.storagePath),
      storagePath: img.storagePath,
      order: img.position,
    })
    map.set(img.questionId, list)
  }
  return map
}

export const fetchImages = async (
  questionIds: string[],
  kind: "statement" | "explanation" = "statement",
) => {
  if (questionIds.length === 0) return new Map<string, ExamImageView[]>()
  const rows = await db
    .select({
      questionId: questionImages.questionId,
      storagePath: questionImages.storagePath,
      position: questionImages.position,
    })
    .from(questionImages)
    .where(
      and(
        eq(questionImages.kind, kind),
        inArray(questionImages.questionId, questionIds),
      ),
    )
    .orderBy(asc(questionImages.position))
  return groupImages(rows)
}

// Forme « pont » historique (`_id`/`_creationTime`/`images`) pour
// rester assignable au contrat `QuestionCardQuestion`/`Doc<"questions">` des
// composants quiz partagés. `correctAnswer`/`explanation`/`references` ne sont
// présents qu'en révision/admin — anti-triche en cours d'examen.
export type ExamQuestionView = {
  _id: string
  _creationTime: number
  question: string
  options: string[]
  objectifCMC: string
  domain: string
  images: ExamImageView[]
  correctAnswer?: string
  explanation?: string
  references?: string[]
  /** Clé retenue par un examen ouvert : correction différée à sa clôture. */
  keyWithheld?: true
}

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
