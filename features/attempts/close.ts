import { and, eq, lt, sql } from "drizzle-orm"
import "server-only"
import type { Db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  trainingSessionItems,
  trainingSessions,
} from "@/db/schema"
import { scoreSql } from "./score"

/**
 * L'unique écrivain de la clôture d'une tentative (`CONTEXT.md` : l'écriture
 * qui ferme une tentative et fixe son score de clôture, qu'elle vienne de
 * l'étudiant ou de l'expiration — `docs/adr/0001`). Le module possède, par
 * type, le compte des justes, le dénominateur et le prédicat d'expiration ;
 * les appelants ne portent que le statut demandé et la forme de `where`.
 *
 * Dénominateur : le LOT de la tentative, répondu ou non — les questions de
 * l'examen blanc pour une participation (figées dès la première
 * participation), le nombre de questions tiré pour une session
 * d'entraînement. Ne pas répondre compte comme une réponse fausse, comme dans
 * l'épreuve réelle. Formule : `scoreSql` (half-up, jumelle de
 * `computeScorePercent`).
 *
 * Une seule instruction ensembliste (`UPDATE … FROM sous-requête scorée`)
 * pour les deux formes de `where`, avec la garde « encore ouverte »
 * re-vérifiée dans le WHERE final : sous READ COMMITTED elle est réévaluée
 * sur la version verrouillée de la ligne, une soumission concurrente gagne,
 * jamais de clobber. Pour une action sous `requireAttempt`, la garde est
 * redondante avec le verrou — et gratuite.
 */
export type Executor = Pick<Db, "select" | "update">

export type CloseWhere =
  /**
   * Une tentative précise. La propriété n'est PAS re-vérifiée ici : `id`
   * doit venir de `requireAttempt` (verrou + `user_id` dans le WHERE) ou
   * d'une lecture filtrée par l'utilisateur courant, jamais du client.
   */
  | { id: string }
  /**
   * Les tentatives expirées avant `expiredBefore`, bornées ; `id` restreint le
   * balayage à une seule (démarrage d'une session d'entraînement qui libère
   * la place).
   */
  | { expiredBefore: Date; limit: number; id?: string }

export type CloseAttemptsArgs =
  | {
      kind: "exam"
      status: "completed" | "auto_submitted"
      now: Date
      where: CloseWhere
      /** Crédit de pause, fourni par la soumission ; le cron n'y touche pas. */
      set?: Pick<
        typeof examParticipations.$inferInsert,
        "pauseStartedAt" | "totalPauseDurationMs"
      >
    }
  | {
      kind: "training"
      status: "completed" | "abandoned"
      now: Date
      where: CloseWhere
    }

const isSweep = (
  where: CloseWhere,
): where is Extract<CloseWhere, { expiredBefore: Date }> =>
  "expiredBefore" in where

const closeParticipations = async (
  exec: Executor,
  { status, now, where, set }: Extract<CloseAttemptsArgs, { kind: "exam" }>,
): Promise<string[]> => {
  const sweep = isSweep(where)
  const scored = exec
    .select({
      id: examParticipations.id,
      correct:
        sql<number>`(select count(*) filter (where ${examAnswers.isCorrect})
        from ${examAnswers}
        where ${examAnswers.participationId} = ${examParticipations.id})`.as(
          "correct",
        ),
      total: sql<number>`(select count(*)
        from ${examQuestions}
        where ${examQuestions.examId} = ${examParticipations.examId})`.as(
        "total",
      ),
    })
    .from(examParticipations)
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .where(
      and(
        eq(examParticipations.status, "in_progress"),
        where.id === undefined
          ? undefined
          : eq(examParticipations.id, where.id),
        sweep ? lt(exams.endDate, where.expiredBefore) : undefined,
      ),
    )
    .limit(sweep ? where.limit : 1)
    .as("scored")

  // ⚠️ Drizzle rend les champs SQL.Aliased de la sous-requête ("correct",
  // "total") NON qualifiés dans le SET — valide uniquement tant qu'aucune
  // colonne de `exam_participations` ne porte ces noms (sinon « column
  // reference is ambiguous » au runtime, invisible à tsc).
  const closed = await exec
    .update(examParticipations)
    .set({
      ...set,
      status,
      score: scoreSql(scored.correct, scored.total),
      completedAt: now,
    })
    .from(scored)
    .where(
      and(
        eq(examParticipations.id, scored.id),
        eq(examParticipations.status, "in_progress"),
      ),
    )
    .returning({ id: examParticipations.id })
  return closed.map((row) => row.id)
}

const closeSessions = async (
  exec: Executor,
  { status, now, where }: Extract<CloseAttemptsArgs, { kind: "training" }>,
): Promise<string[]> => {
  const sweep = isSweep(where)
  // LEFT JOIN + GROUP BY plutôt qu'une sous-requête corrélée : dans une
  // sous-requête `.as()` MONO-table, Drizzle rend les colonnes SANS
  // qualification — la corrélation (`"session_id" = "id"`) se lierait alors à
  // la table interne (count toujours 0). Un JOIN force la qualification
  // complète et supprime la corrélation.
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
        where.id === undefined ? undefined : eq(trainingSessions.id, where.id),
        sweep ? lt(trainingSessions.expiresAt, where.expiredBefore) : undefined,
      ),
    )
    .groupBy(trainingSessions.id)
    .limit(sweep ? where.limit : 1)
    .as("scored")

  // ⚠️ Même réserve que ci-dessus sur le SET ("correct" non qualifié).
  const closed = await exec
    .update(trainingSessions)
    .set({
      status,
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
  return closed.map((row) => row.id)
}

/** Clôt les tentatives visées et renvoie leurs identifiants. */
export const closeAttempts = (
  exec: Executor,
  args: CloseAttemptsArgs,
): Promise<string[]> =>
  args.kind === "exam"
    ? closeParticipations(exec, args)
    : closeSessions(exec, args)
