import { type SQL, inArray, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { type LockUser, excludeLocked } from "../questions/answer-key-lock"
import { QUESTION_SUCCESS_MIN_ANSWERS } from "./question-success-threshold"

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
// Maîtrise (étudiant)
// ============================================

/**
 * Dernière réponse datée de `viewer` à chaque question encore dans la banque,
 * avec son domaine et son objectif. Une question dont la clé est retenue pour
 * lui est écartée tout entière (`excludeLocked`), réponses d'entraînement
 * antérieures comprises. `before` : la dernière réponse d'avant cet instant,
 * pour relire la maîtrise au début d'une période ; une réponse sans date y
 * reste, comme elle reste la plus ancienne sans `before`. Colonnes :
 * question_id, is_correct, domain, objective_id.
 */
export const latestAnswersSql = (viewer: LockUser, before?: Date) => sql`
  select l.question_id, l.is_correct, q.domain, q.objective_id
    from (
      select distinct on (x.question_id) x.question_id, x.is_correct
        from (${datedAnswersSql({ userId: viewer.id })}) x
       ${before ? sql`where x.answered_at < ${before} or x.answered_at is null` : sql``}
       order by x.question_id, x.answered_at desc nulls last, x.answer_id
    ) l
    join questions q on q.id = l.question_id
   where q.deleted_at is null
     and ${excludeLocked(viewer, sql`l.question_id`)}`

/** Part de justes parmi les questions comptées, en % arrondi ; `null` sans réponse, jamais 0. */
export const masteryPercent = (
  correct: number,
  answered: number,
): number | null =>
  answered === 0 ? null : Math.round((100 * correct) / answered)

// ============================================
// Taux de réussite d'une question (admin)
// ============================================

export { QUESTION_SUCCESS_MIN_ANSWERS }

const studentFirstAnswersSql = (questionIds?: string[]) => sql`
  select distinct on (x.user_id, x.question_id)
         x.question_id, x.selected_answer, x.is_correct
    from (${datedAnswersSql({ questionIds })}) x
    join "user" u on u.id = x.user_id
   where u.role = 'user'
     and u.deleted_at is null
   order by x.user_id, x.question_id, x.answered_at nulls last, x.answer_id`

/**
 * Première réponse de chaque étudiant à chaque question (entraînement et
 * examens), comptes admin et supprimés exclus. Une réponse d'examen est datée
 * de la clôture de sa participation. Colonnes : question_id, selected_answer,
 * is_current (le texte est encore une option de la question) et is_correct,
 * la justesse retenue : sur la clé ACTUELLE si l'option existe encore (une clé
 * corrigée recompte les réponses passées), sur le verdict enregistré pour une
 * formulation antérieure (une option-clé reformulée ne rend pas fausses les
 * réponses justes). Lecture admin, donc pas de verrou de clé de réponse.
 */
export const firstAnswersSql = (questionIds?: string[]) => sql`
  select f.question_id, f.selected_answer,
         q.options ? f.selected_answer as is_current,
         case when q.options ? f.selected_answer
              then f.selected_answer = q.correct_answer
              else f.is_correct
         end as is_correct
    from (${studentFirstAnswersSql(questionIds)}) f
    join questions q on q.id = f.question_id`

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
        select question_id, is_current, is_correct, count(*) as n
          from first_answers
         group by question_id, selected_answer, is_current, is_correct
      )
      select question_id as qs_question_id,
             sum(n)::int as qs_answer_count,
             case when sum(n) >= ${QUESTION_SUCCESS_MIN_ANSWERS}
               then round(
                 100.0 * coalesce(sum(n) filter (where is_correct), 0) / sum(n)
               )::int
             end as qs_success_rate,
             sum(n) >= ${QUESTION_SUCCESS_MIN_ANSWERS}
               and coalesce(
                 max(n) filter (where is_current and not is_correct), 0
               ) > coalesce(sum(n) filter (where is_correct), 0)
               as qs_key_suspect
        from per_option
       group by question_id`)
