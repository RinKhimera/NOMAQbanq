import { and, eq, lt, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
} from "@/db/schema"

export type CloseExpiredParticipationsResult = { closedCount: number }

/**
 * Ferme les participations `in_progress` dont l'examen est terminé (`endDate < now`),
 * en calculant le score à partir des réponses enregistrées. Appelé par la route cron
 * Vercel.
 *
 * - UNE requête ensembliste (UPDATE … FROM sous-requête bornée à 500) : pas de
 *   N+1, une seule connexion du pool.
 * - Garde `status='in_progress'` re-vérifiée dans le WHERE final : sous READ
 *   COMMITTED la condition est réévaluée sur la version verrouillée de la ligne
 *   → une soumission concurrente gagne, pas de clobber.
 * - Arrondi `round()` numeric = half-up EXACT — la référence du projet ;
 *   `finalizeExam` s'aligne via `computeScorePercent` (lib/score.ts).
 * - Statut de fermeture = `auto_submitted`.
 */
export async function closeExpiredExamParticipations(): Promise<CloseExpiredParticipationsResult> {
  const now = new Date()

  const scored = db
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
      and(eq(examParticipations.status, "in_progress"), lt(exams.endDate, now)),
    )
    .limit(500)
    .as("scored")

  // ⚠️ Drizzle rend les champs SQL.Aliased de la sous-requête ("correct",
  // "total") NON qualifiés dans le SET — valide uniquement tant qu'aucune
  // colonne de `exam_participations` ne porte ces noms (sinon « column
  // reference is ambiguous » au runtime, invisible à tsc).
  const closed = await db
    .update(examParticipations)
    .set({
      status: "auto_submitted",
      score: sql`case when ${scored.total} > 0
        then round(${scored.correct} * 100.0 / ${scored.total})::int
        else 0 end`,
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

  return { closedCount: closed.length }
}
