import { type SQL, inArray, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"

/*
 * Constructeurs SQL des statistiques de réponses : ils n'exécutent rien et ne
 * gardent rien. Seules des lectures gardées les exécutent (`./dal` et
 * `getQuestionsWithFilters`, admin) ; un nouvel appelant reprend cette garde,
 * et une lecture étudiant passe en plus par le verrou de clé de réponse.
 */

// ============================================
// Réponses datées (maîtrise, taux de réussite)
// ============================================

/**
 * Toutes les réponses données (justesse connue), entraînement et examens,
 * chacune avec sa date d'une réponse : la validation pour l'entraînement, la
 * clôture de la participation pour un examen, car une réponse d'examen reste
 * modifiable jusque-là. Une participation non close n'a pas encore de réponse
 * datée. Une session d'entraînement en cours non plus : en mode test, sa
 * justesse est enregistrée mais cachée à l'étudiant jusqu'à la fin, et une
 * statistique qui la compterait la lui donnerait réponse par réponse (même
 * règle que le corpus de révision). Colonnes : answer_id (départage stable),
 * user_id, question_id, selected_answer, is_correct, answered_at.
 */
export const datedAnswersSql = ({
  userId,
  questionIds,
}: {
  userId?: string
  questionIds?: string[]
}) => {
  const scoped = (userColumn: SQL, questionColumn: SQL) =>
    sql`${userId ? sql`and ${userColumn} = ${userId}` : sql``}
        ${questionIds ? sql`and ${inArray(questionColumn, questionIds)}` : sql``}`
  return sql`
    select i.id as answer_id, s.user_id, i.question_id, i.selected_answer,
           i.is_correct, i.answered_at
      from training_session_items i
      join training_sessions s on s.id = i.session_id
     where i.is_correct is not null
       and s.status <> 'in_progress'
       ${scoped(sql`s.user_id`, sql`i.question_id`)}
    union all
    select a.id, p.user_id, a.question_id, a.selected_answer, a.is_correct,
           p.completed_at
      from exam_answers a
      join exam_participations p on p.id = a.participation_id
     where a.is_correct is not null
       and p.completed_at is not null
       ${scoped(sql`p.user_id`, sql`a.question_id`)}`
}

// ============================================
// Taux de réussite d'une question (admin)
// ============================================

/** En dessous de ce nombre de réponses, un taux de réussite n'est pas significatif. */
export const QUESTION_SUCCESS_MIN_ANSWERS = 10

/**
 * Première réponse de chaque étudiant à chaque question (entraînement et
 * examens), comptes admin et supprimés exclus. Une réponse d'examen est datée
 * de la clôture de sa participation. Justesse jugée sur la clé ACTUELLE : une
 * clé corrigée recompte les réponses passées. Lecture admin, donc pas de
 * verrou de clé de réponse.
 */
export const firstAnswersSql = (questionIds?: string[]) => sql`
  select distinct on (x.user_id, x.question_id)
         x.question_id, x.selected_answer
    from (${datedAnswersSql({ questionIds })}) x
    join "user" u on u.id = x.user_id
   where u.role = 'user'
     and u.deleted_at is null
   order by x.user_id, x.question_id, x.answered_at nulls last, x.answer_id`

/**
 * CTE des statistiques par question, à joindre sur `questions.id`. Colonnes
 * préfixées `qs_` : Drizzle les référence sans qualification. Sans
 * `questionIds`, couvre toute la banque (tri et filtre « À vérifier »).
 */
export const questionSuccessStats = (questionIds?: string[]) =>
  db.$with("question_success", {
    questionId: sql<string>`qs_question_id`.as("qs_question_id"),
    answerCount: sql<number>`qs_answer_count`.as("qs_answer_count"),
    successRate: sql<number | null>`qs_success_rate`.as("qs_success_rate"),
    keySuspect: sql<boolean>`qs_key_suspect`.as("qs_key_suspect"),
  }).as(sql`
      with first_answers as (${firstAnswersSql(questionIds)}),
      per_option as (
        select f.question_id,
               f.selected_answer = q.correct_answer as is_key,
               count(*) as n
          from first_answers f
          join questions q on q.id = f.question_id
         group by f.question_id, f.selected_answer, q.correct_answer
      )
      select question_id as qs_question_id,
             sum(n)::int as qs_answer_count,
             case when sum(n) >= ${QUESTION_SUCCESS_MIN_ANSWERS}
               then round(
                 100.0 * coalesce(sum(n) filter (where is_key), 0) / sum(n)
               )::int
             end as qs_success_rate,
             sum(n) >= ${QUESTION_SUCCESS_MIN_ANSWERS}
               and coalesce(max(n) filter (where not is_key), 0)
                 > coalesce(sum(n) filter (where is_key), 0)
               as qs_key_suspect
        from per_option
       group by question_id`)
