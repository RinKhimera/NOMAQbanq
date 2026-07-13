import { and, eq, lt, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { trainingSessionItems, trainingSessions } from "@/db/schema"

export type CloseExpiredTrainingResult = { closedCount: number }

/**
 * Ferme les sessions d'entraînement `in_progress` expirées (`expiresAt < now`,
 * TTL 24h), score = % d'items corrects sur `questionCount`. Appelé par la route
 * cron Vercel.
 *
 * - UNE requête ensembliste (UPDATE … FROM sous-requête bornée à 100), garde
 *   `status='in_progress'` re-vérifiée dans le WHERE final (idem cron examens) :
 *   pas de clobber d'une complétion concurrente.
 * - Arrondi `round()` numeric = half-up EXACT (référence projet, cf. lib/score.ts).
 * - Statut de fermeture = `abandoned`.
 */
export async function closeExpiredTrainingSessions(): Promise<CloseExpiredTrainingResult> {
  const now = new Date()

  // LEFT JOIN + GROUP BY plutôt qu'une sous-requête corrélée : dans une
  // sous-requête `.as()` MONO-table, Drizzle rend les colonnes SANS
  // qualification — la corrélation (`"session_id" = "id"`) se lierait alors à
  // la table interne (count toujours 0). Un JOIN force la qualification
  // complète (cf. cron examens) et supprime la corrélation.
  const scored = db
    .select({
      id: trainingSessions.id,
      questionCount: trainingSessions.questionCount,
      correct:
        sql<number>`count(*) filter (where ${trainingSessionItems.isCorrect})`.as(
          "correct",
        ),
    })
    .from(trainingSessions)
    .leftJoin(
      trainingSessionItems,
      eq(trainingSessionItems.sessionId, trainingSessions.id),
    )
    .where(
      and(
        eq(trainingSessions.status, "in_progress"),
        lt(trainingSessions.expiresAt, now),
      ),
    )
    .groupBy(trainingSessions.id)
    .limit(100)
    .as("scored")

  // ⚠️ Drizzle rend le champ SQL.Aliased de la sous-requête ("correct") NON
  // qualifié dans le SET — valide uniquement tant qu'aucune colonne de
  // `training_sessions` ne porte ce nom (sinon « column reference is
  // ambiguous » au runtime, invisible à tsc).
  const closed = await db
    .update(trainingSessions)
    .set({
      status: "abandoned",
      score: sql`case when ${scored.questionCount} > 0
        then round(${scored.correct} * 100.0 / ${scored.questionCount})::int
        else 0 end`,
      completedAt: now,
    })
    .from(scored)
    .where(
      and(
        eq(trainingSessions.id, scored.id),
        eq(trainingSessions.status, "in_progress"),
      ),
    )
    .returning({ id: trainingSessions.id })

  return { closedCount: closed.length }
}
