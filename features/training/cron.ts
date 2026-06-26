import { and, eq, inArray, lt, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { trainingSessionItems, trainingSessions } from "@/db/schema"

export type CloseExpiredTrainingResult = { closedCount: number }

/**
 * Ferme les sessions d'entraînement `in_progress` expirées (`expiresAt < now`, TTL
 * 24h), en calculant le score à partir des items répondus. Remplace
 * `training.closeExpiredTrainingSessions` (cron Convex horaire). Appelé par la route
 * cron Vercel.
 *
 * - Borné à 100 par exécution.
 * - UPDATE gardé `status='in_progress'` (idem cron examens) : pas de clobber d'une
 *   complétion concurrente.
 * - Statut de fermeture = `abandoned` (parité Convex). Score = % d'items corrects sur
 *   `questionCount`.
 */
export async function closeExpiredTrainingSessions(): Promise<CloseExpiredTrainingResult> {
  const now = new Date()

  const expired = await db
    .select({
      id: trainingSessions.id,
      questionCount: trainingSessions.questionCount,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, "in_progress"),
        lt(trainingSessions.expiresAt, now),
      ),
    )
    .limit(100)
  if (expired.length === 0) return { closedCount: 0 }

  const ids = expired.map((s) => s.id)
  const correctRows = await db
    .select({
      sessionId: trainingSessionItems.sessionId,
      correct:
        sql<number>`count(*) filter (where ${trainingSessionItems.isCorrect})`.mapWith(
          Number,
        ),
    })
    .from(trainingSessionItems)
    .where(inArray(trainingSessionItems.sessionId, ids))
    .groupBy(trainingSessionItems.sessionId)
  const correctMap = new Map(correctRows.map((r) => [r.sessionId, r.correct]))

  let closedCount = 0
  await db.transaction(async (tx) => {
    for (const s of expired) {
      const correct = correctMap.get(s.id) ?? 0
      const score =
        s.questionCount > 0 ? Math.round((correct / s.questionCount) * 100) : 0
      const updated = await tx
        .update(trainingSessions)
        .set({ status: "abandoned", score, completedAt: now })
        .where(
          and(
            eq(trainingSessions.id, s.id),
            eq(trainingSessions.status, "in_progress"),
          ),
        )
        .returning({ id: trainingSessions.id })
      if (updated.length > 0) closedCount++
    }
  })

  return { closedCount }
}
