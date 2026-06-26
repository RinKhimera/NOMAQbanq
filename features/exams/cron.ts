import { and, eq, inArray, lt, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
} from "@/db/schema"

export type CloseExpiredParticipationsResult = {
  closedCount: number
  processedCount: number
}

/**
 * Ferme les participations `in_progress` dont l'examen est terminé (`endDate < now`),
 * en calculant le score à partir des réponses enregistrées. Remplace
 * `exams.closeExpiredParticipations` (cron Convex horaire). Appelé par la route cron
 * Vercel.
 *
 * - Borné à 500 par exécution (le cron repasse à la prochaine heure).
 * - UPDATE gardé `status='in_progress'` : si l'utilisateur a soumis entre la lecture
 *   et l'écriture, l'UPDATE est un no-op (on ne clobbere pas une vraie soumission).
 * - Statut de fermeture = `auto_submitted` (parité Convex).
 */
export async function closeExpiredExamParticipations(): Promise<CloseExpiredParticipationsResult> {
  const now = new Date()

  const expired = await db
    .select({
      id: examParticipations.id,
      examId: examParticipations.examId,
    })
    .from(examParticipations)
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .where(
      and(eq(examParticipations.status, "in_progress"), lt(exams.endDate, now)),
    )
    .limit(500)
  if (expired.length === 0) return { closedCount: 0, processedCount: 0 }

  const partIds = expired.map((p) => p.id)
  const examIds = [...new Set(expired.map((p) => p.examId))]

  const [correctRows, totalRows] = await Promise.all([
    db
      .select({
        participationId: examAnswers.participationId,
        correct:
          sql<number>`count(*) filter (where ${examAnswers.isCorrect})`.mapWith(
            Number,
          ),
      })
      .from(examAnswers)
      .where(inArray(examAnswers.participationId, partIds))
      .groupBy(examAnswers.participationId),
    db
      .select({
        examId: examQuestions.examId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(examQuestions)
      .where(inArray(examQuestions.examId, examIds))
      .groupBy(examQuestions.examId),
  ])
  const correctMap = new Map(
    correctRows.map((r) => [r.participationId, r.correct]),
  )
  const totalMap = new Map(totalRows.map((r) => [r.examId, r.total]))

  let closedCount = 0
  await db.transaction(async (tx) => {
    for (const p of expired) {
      const total = totalMap.get(p.examId) ?? 0
      const correct = correctMap.get(p.id) ?? 0
      const score = total > 0 ? Math.round((correct / total) * 100) : 0
      const updated = await tx
        .update(examParticipations)
        .set({ status: "auto_submitted", score, completedAt: now })
        .where(
          and(
            eq(examParticipations.id, p.id),
            eq(examParticipations.status, "in_progress"),
          ),
        )
        .returning({ id: examParticipations.id })
      if (updated.length > 0) closedCount++
    }
  })

  return { closedCount, processedCount: expired.length }
}
