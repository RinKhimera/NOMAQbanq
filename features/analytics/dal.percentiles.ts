import { and, eq, inArray, lte, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { examParticipations, exams, user } from "@/db/schema"
import { ownerReadableScore } from "../exams/dal.student"
import { examPopulation } from "../exams/population"

/** En dessous de ce nombre de participations lisibles, pas de percentile. */
export const PERCENTILE_MIN_COHORT = 5

/** Percentile d'examen par id d'examen ; `null` = non disponible. */
export type ExamPercentiles = Record<string, number | null>

/**
 * Percentiles des participations de `userId` aux examens clos (tous, ou ceux
 * de `examIds`). Le groupe de pairs est celui du classement, restreint aux
 * comptes étudiants non supprimés, et lu par la même retenue
 * (`ownerReadableScore`) : une participation au score retenu n'est ni cible
 * ni pair. Sans garde : l'appelant la porte.
 */
export const percentilesOf = async (
  userId: string,
  examIds?: string[],
): Promise<ExamPercentiles> => {
  const cohort = db
    .select({
      id: examParticipations.id,
      examId: examParticipations.examId,
      userId: examParticipations.userId,
      score: ownerReadableScore.as("score"),
    })
    .from(examParticipations)
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .innerJoin(user, eq(user.id, examParticipations.userId))
    .where(
      and(
        lte(exams.endDate, new Date()),
        examPopulation,
        inArray(
          examParticipations.examId,
          db
            .select({ examId: examParticipations.examId })
            .from(examParticipations)
            .where(
              and(
                eq(examParticipations.userId, userId),
                examIds
                  ? inArray(examParticipations.examId, examIds)
                  : undefined,
              ),
            )
            .limit(200),
        ),
      ),
    )

  const result = await db.execute<{
    exam_id: string
    percentile: number | null
  }>(sql`
    with cohort as (${cohort})
    -- Arrondi inférieur : « mieux que X % » ne doit jamais surestimer.
    select t.exam_id,
           case
             when t.score is null
               or count(o.score) < ${PERCENTILE_MIN_COHORT} then null
             else floor(
               100.0 * count(*) filter (where o.score < t.score)
                     / (count(o.score) - 1)
             )::int
           end as percentile
      from cohort t
      join cohort o on o.exam_id = t.exam_id
     where t.user_id = ${userId}
     group by t.exam_id, t.score`)

  return Object.fromEntries(result.rows.map((r) => [r.exam_id, r.percentile]))
}
