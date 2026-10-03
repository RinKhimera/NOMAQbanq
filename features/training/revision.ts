import { type SQL, sql } from "drizzle-orm"
import "server-only"
import { type Db, db } from "@/db"
import { type LockUser, excludeLocked } from "../questions/answer-key-lock"
import type { RevisionCounts } from "./revision-pool"
import type { RevisionCriterion } from "./schemas"

// `db` ou une transaction : le tirage doit pouvoir vivre dans la transaction qui
// insère la session.
type Executor = Pick<Db, "execute">

export type RevisionScope = {
  /**
   * Lecteur du corpus, rôle compris : le verrou de clé de réponse s'applique à
   * la SÉLECTION (voir `excludeLocked`), et un admin n'y est pas soumis.
   */
  viewer: LockUser
  domain?: string
  /** Objectifs du référentiel. */
  objectiveIds?: string[]
}

// Historique unifié entraînement + examens de l'utilisateur, réduit à sa
// DERNIÈRE tentative par question.
//
// Les sessions `in_progress` sont EXCLUES : en mode test, `isCorrect` est masqué
// sur les trois canaux de lecture tant que la session n'est pas terminée. Sans
// cette exclusion, le compteur « Ratées » en devient le quatrième — sonder entre
// deux réponses donne un bit de correction par tentative, et `saveTrainingAnswer`
// autorise la ré-écriture d'un item. Coût assumé : en mode tuteur (où la
// correction est déjà révélée), les réponses de la session courante ne comptent
// qu'à sa clôture. `exam_answers.created_at` vaut « début de la
// tentative » (lignes pré-créées au démarrage de l'examen, jamais réhorodatées) :
// un entraînement intercalé pendant un examen long peut donc être classé à tort
// comme la tentative la plus récente. Limite assumée, documentée dans le spec.
const historyCte = (userId: string): SQL => sql`
  attempts as (
    select i.question_id, i.is_correct, i.answered_at as at
      from training_session_items i
      join training_sessions s on s.id = i.session_id
     where s.user_id = ${userId} and i.selected_answer is not null
       and s.status <> 'in_progress'
    union all
    select a.question_id, a.is_correct, a.created_at as at
      from exam_answers a
      join exam_participations p on p.id = a.participation_id
     where p.user_id = ${userId} and a.selected_answer is not null
  ),
  last_attempt as (
    select distinct on (question_id) question_id, is_correct
      from attempts
     order by question_id, at desc
  ),
  marked as (
    select question_id from question_bookmarks where user_id = ${userId}
    union
    select a.question_id
      from exam_answers a
      join exam_participations p on p.id = a.participation_id
     where p.user_id = ${userId} and a.is_flagged
  )
`

// Le marquage se lit hors agrégat : une question marquée mais jamais répondue
// compte comme marquée.
const CRITERION_PREDICATE: Record<RevisionCriterion, SQL> = {
  failed: sql`q.id in (select question_id from last_attempt where is_correct = false)`,
  bookmarked: sql`q.id in (select question_id from marked)`,
  unseen: sql`not exists (select 1 from attempts a2 where a2.question_id = q.id)`,
}

const corpusWhere = ({ viewer, domain, objectiveIds }: RevisionScope): SQL => {
  const parts: SQL[] = [sql`q.deleted_at is null`]
  if (domain && domain !== "all") parts.push(sql`q.domain = ${domain}`)

  if (objectiveIds?.length) {
    parts.push(
      sql`q.objective_id in (${sql.join(
        objectiveIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
  }

  // Verrou anti-triche appliqué à la SÉLECTION, pas seulement à la révélation :
  // l'appartenance d'une question au lot est elle-même un oracle sur les
  // réponses d'un examen encore ouvert.
  parts.push(excludeLocked(viewer, sql`q.id`))
  return sql.join(parts, sql` and `)
}

/**
 * Compteur par critère, sur le corpus filtré (domaine + objectifs), plus les
 * recoupements de « marquées » avec les deux autres : le formulaire en déduit
 * le nombre de questions distinctes de toute combinaison (`revisionPoolSize`).
 */
export const getRevisionCounts = async (
  viewer: LockUser,
  scope: Omit<RevisionScope, "viewer"> = {},
): Promise<RevisionCounts> => {
  const { failed, unseen, bookmarked } = CRITERION_PREDICATE
  const res = await db.execute(sql`
    with ${historyCte(viewer.id)}
    select
      (count(*) filter (where ${failed}))::int as failed,
      (count(*) filter (where ${unseen}))::int as unseen,
      (count(*) filter (where ${bookmarked}))::int as bookmarked,
      (count(*) filter (where ${bookmarked} and ${failed}))::int as bookmarked_failed,
      (count(*) filter (where ${bookmarked} and ${unseen}))::int as bookmarked_unseen
      from questions q
     where ${corpusWhere({ viewer, ...scope })}
  `)
  // Le cast `::int` est indispensable : sans lui, `count(*)` remonte en bigint,
  // que le driver pg rend en `string`.
  const row = res.rows[0] as Record<string, unknown> | undefined
  const n = (key: string) => Number(row?.[key] ?? 0)
  return {
    failed: n("failed"),
    unseen: n("unseen"),
    bookmarked: n("bookmarked"),
    bookmarkedFailed: n("bookmarked_failed"),
    bookmarkedUnseen: n("bookmarked_unseen"),
  }
}

/**
 * Tirage aléatoire dans le corpus de révision. Les critères s'unissent en OU, le
 * tout intersecté avec domaine + objectifs. Renvoie moins que `limit` quand le
 * corpus est plus court — l'appelant démarre avec ce qu'il obtient.
 */
export const pickRevisionQuestionIds = async (
  exec: Executor,
  {
    criteria,
    limit,
    ...scope
  }: RevisionScope & {
    criteria: RevisionCriterion[]
    limit: number
  },
): Promise<string[]> => {
  const unique = [...new Set(criteria)]
  if (unique.length === 0 || limit <= 0) return []

  const anyCriterion = sql.join(
    unique.map((c) => CRITERION_PREDICATE[c]),
    sql` or `,
  )
  const res = await exec.execute(sql`
    with ${historyCte(scope.viewer.id)}
    select q.id
      from questions q
     where ${corpusWhere(scope)} and (${anyCriterion})
     order by random()
     limit ${limit}
  `)
  return res.rows.map((r) => String(r.id))
}
