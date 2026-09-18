import { and, eq, lt, sql } from "drizzle-orm"
import "server-only"
import { type Db, db } from "@/db"
import { trainingSessionItems, trainingSessions } from "@/db/schema"
import { scoreSql } from "../attempts/score"

export type CloseExpiredTrainingResult = { closedCount: number }

type Executor = Pick<Db, "select" | "update">

/**
 * L'unique écrivain de la clôture par expiration d'une session d'entraînement
 * (`docs/adr/0001`) : `in_progress` et `expiresAt < now` → `abandoned`, score
 * = % d'items corrects sur `questionCount`, `completedAt` posé. Le cron
 * balaie tout ; `createTrainingSession` cible la seule session qui lui barre
 * la place, sous son propre verrou (d'où l'exécuteur en paramètre).
 *
 * - UNE requête ensembliste (UPDATE … FROM sous-requête bornée à 100), garde
 *   `status='in_progress'` re-vérifiée dans le WHERE final (idem cron examens) :
 *   pas de clobber d'une complétion concurrente.
 */
export const expireTrainingSessions = async (
  exec: Executor,
  { now, sessionId }: { now: Date; sessionId?: string },
): Promise<CloseExpiredTrainingResult> => {
  // LEFT JOIN + GROUP BY plutôt qu'une sous-requête corrélée : dans une
  // sous-requête `.as()` MONO-table, Drizzle rend les colonnes SANS
  // qualification — la corrélation (`"session_id" = "id"`) se lierait alors à
  // la table interne (count toujours 0). Un JOIN force la qualification
  // complète (cf. cron examens) et supprime la corrélation.
  const scored = exec
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
        sessionId ? eq(trainingSessions.id, sessionId) : undefined,
      ),
    )
    .groupBy(trainingSessions.id)
    .limit(100)
    .as("scored")

  // ⚠️ Drizzle rend le champ SQL.Aliased de la sous-requête ("correct") NON
  // qualifié dans le SET — valide uniquement tant qu'aucune colonne de
  // `training_sessions` ne porte ce nom (sinon « column reference is
  // ambiguous » au runtime, invisible à tsc).
  const closed = await exec
    .update(trainingSessions)
    .set({
      status: "abandoned",
      score: scoreSql(scored.correct, scored.questionCount),
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

/** Appelé par la route cron Vercel. */
export async function closeExpiredTrainingSessions(): Promise<CloseExpiredTrainingResult> {
  return expireTrainingSessions(db, { now: new Date() })
}
