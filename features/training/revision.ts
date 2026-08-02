import { type SQL, sql } from "drizzle-orm"
import "server-only"
import { type Db, db } from "@/db"
import { getUserOpenExamLockedQuestionIds } from "../exams/dal.shared"
import type { RevisionCriterion } from "./schemas"

// `db` ou une transaction : le tirage doit pouvoir vivre dans la transaction qui
// insère la session.
type Executor = Pick<Db, "execute">

export type RevisionCounts = Record<RevisionCriterion, number>

export type RevisionScope = {
  userId: string
  domain?: string
  objectifsCMCs?: string[]
}

// Historique unifié entraînement + examens de l'utilisateur, réduit à sa
// DERNIÈRE tentative par question. `exam_answers.created_at` vaut « début de la
// tentative » (lignes pré-créées au démarrage de l'examen, jamais réhorodatées) :
// un entraînement intercalé pendant un examen long peut donc être classé à tort
// comme la tentative la plus récente. Limite assumée, documentée dans le spec.
const historyCte = (userId: string): SQL => sql`
  attempts as (
    select i.question_id, i.is_correct, i.answered_at as at
      from training_session_items i
      join training_sessions s on s.id = i.session_id
     where s.user_id = ${userId} and i.selected_answer is not null
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

const corpusWhere = (
  { domain, objectifsCMCs }: RevisionScope,
  lockedIds: string[],
): SQL => {
  const parts: SQL[] = [sql`q.deleted_at is null`]
  if (domain && domain !== "all") parts.push(sql`q.domain = ${domain}`)

  const objectifs =
    objectifsCMCs?.map((o) => o.trim().toLowerCase()).filter(Boolean) ?? []
  if (objectifs.length > 0) {
    parts.push(
      sql`lower(q.objectif_cmc) in (${sql.join(
        objectifs.map((o) => sql`${o}`),
        sql`, `,
      )})`,
    )
  }

  // Verrou anti-triche appliqué à la SÉLECTION, pas seulement à la révélation :
  // l'appartenance d'une question au lot est elle-même un oracle sur les
  // réponses d'un examen encore ouvert.
  if (lockedIds.length > 0) {
    parts.push(
      sql`q.id not in (${sql.join(
        lockedIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
  }
  return sql.join(parts, sql` and `)
}

/**
 * Identifiants à exclure du corpus. À résoudre AVANT d'ouvrir une transaction :
 * le pool pg est à `max: 5` sans timeout d'acquisition, donc réclamer une 2ᵉ
 * connexion pendant qu'on en détient une fige la requête — et cinq créations
 * concurrentes figent l'application.
 */
export const resolveRevisionLock = async (
  userId: string,
): Promise<string[]> => [...(await getUserOpenExamLockedQuestionIds(userId))]

/** Compteur par critère, sur le corpus filtré (domaine + objectifs). */
export const getRevisionCounts = async (
  userId: string,
  scope: Omit<RevisionScope, "userId"> = {},
): Promise<RevisionCounts> => {
  const lockedIds = await resolveRevisionLock(userId)
  const res = await db.execute(sql`
    with ${historyCte(userId)}
    select
      (count(*) filter (where ${CRITERION_PREDICATE.failed}))::int as failed,
      (count(*) filter (where ${CRITERION_PREDICATE.unseen}))::int as unseen,
      (count(*) filter (where ${CRITERION_PREDICATE.bookmarked}))::int as bookmarked
      from questions q
     where ${corpusWhere({ userId, ...scope }, lockedIds)}
  `)
  // Le cast `::int` est indispensable : sans lui, `count(*)` remonte en bigint,
  // que le driver pg rend en `string`.
  const row = res.rows[0] as Partial<RevisionCounts> | undefined
  return {
    failed: Number(row?.failed ?? 0),
    unseen: Number(row?.unseen ?? 0),
    bookmarked: Number(row?.bookmarked ?? 0),
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
    lockedIds,
    ...scope
  }: RevisionScope & {
    criteria: RevisionCriterion[]
    limit: number
    /**
     * Résolus par `resolveRevisionLock` HORS transaction. Paramètre REQUIS : un
     * oubli casse la compilation au lieu de rouvrir le trou anti-triche.
     */
    lockedIds: string[]
  },
): Promise<string[]> => {
  const unique = [...new Set(criteria)]
  if (unique.length === 0 || limit <= 0) return []

  const anyCriterion = sql.join(
    unique.map((c) => CRITERION_PREDICATE[c]),
    sql` or `,
  )
  const res = await exec.execute(sql`
    with ${historyCte(scope.userId)}
    select q.id
      from questions q
     where ${corpusWhere(scope, lockedIds)} and (${anyCriterion})
     order by random()
     limit ${limit}
  `)
  return res.rows.map((r) => String(r.id))
}
