import { db } from "@/db"
import { examAudience, examQuestions, exams } from "@/db/schema"
import { SECONDS_PER_QUESTION } from "@/features/exams/schemas"
import { createId } from "@/lib/ids"

/**
 * Examen blanc finalisé inséré sans passer par `createExam` : jeu de toute
 * taille (sous le minimum du visé compris), ordre des questions conservé, fin
 * passée permise. Pour les tests dont l'examen n'est qu'une fixture ; les
 * règles de création se testent par l'action.
 */
export const seedExam = async (opts: {
  title: string
  createdBy: string
  startDate: number
  endDate: number
  questionIds: string[]
  enablePause?: boolean
  pauseDurationMinutes?: number
  audienceUserIds?: string[]
}): Promise<string> => {
  const id = createId()
  const restricted = opts.audienceUserIds !== undefined
  await db.insert(exams).values({
    id,
    title: opts.title,
    startDate: new Date(opts.startDate),
    endDate: new Date(opts.endDate),
    completionTime: opts.questionIds.length * SECONDS_PER_QUESTION,
    targetQuestionCount: opts.questionIds.length,
    enablePause: opts.enablePause ?? false,
    pauseDurationMinutes: opts.enablePause
      ? (opts.pauseDurationMinutes ?? null)
      : null,
    audienceType: restricted ? "restricted" : "subscribers",
    createdBy: opts.createdBy,
  })
  await db.insert(examQuestions).values(
    opts.questionIds.map((questionId, position) => ({
      examId: id,
      questionId,
      position,
    })),
  )
  if (restricted && opts.audienceUserIds?.length) {
    await db
      .insert(examAudience)
      .values(opts.audienceUserIds.map((userId) => ({ examId: id, userId })))
  }
  return id
}
