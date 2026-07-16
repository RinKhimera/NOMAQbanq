import { and, asc, eq, gt, inArray, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import {
  examParticipations,
  examQuestions,
  exams,
  questionImages,
} from "@/db/schema"
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

/**
 * Parmi `questionIds`, celles appartenant à un examen OUVERT (`endDate` future)
 * où `userId` a une participation (tout statut). La banque de questions étant
 * partagée training/examens, la clé de réponse de ces questions ne doit fuiter
 * par AUCUN canal de révision pendant la fenêtre d'examen (explications lazy,
 * correction d'entraînement). Compromis assumé : la révision training de ces
 * questions est différée jusqu'à la clôture de l'examen.
 */
export const getOpenExamLockedQuestionIds = async (
  userId: string,
  questionIds: string[],
): Promise<Set<string>> => {
  if (questionIds.length === 0) return new Set()
  const rows = await db
    .selectDistinct({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .innerJoin(
      examParticipations,
      eq(examParticipations.examId, examQuestions.examId),
    )
    .where(
      and(
        eq(examParticipations.userId, userId),
        gt(exams.endDate, new Date()),
        inArray(examQuestions.questionId, questionIds),
      ),
    )
  return new Set(rows.map((r) => r.questionId))
}

/**
 * Variante ANONYME de `getOpenExamLockedQuestionIds` : parmi `questionIds`,
 * celles figurant dans AU MOINS un examen ouvert (`endDate` future), sans
 * dimension utilisateur. Canal public du quiz marketing (#91) : l'appelant
 * étant anonyme, la clé d'une question d'examen ouvert ne doit fuiter pour
 * PERSONNE — une question aussi présente dans un examen clos reste verrouillée
 * (l'examen ouvert prime).
 */
export const getOpenExamQuestionIds = async (
  questionIds: string[],
): Promise<Set<string>> => {
  if (questionIds.length === 0) return new Set()
  const rows = await db
    .selectDistinct({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(
      and(
        gt(exams.endDate, new Date()),
        inArray(examQuestions.questionId, questionIds),
      ),
    )
  return new Set(rows.map((r) => r.questionId))
}
