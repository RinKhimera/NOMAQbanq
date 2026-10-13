import { type SQL, and, asc, desc, eq, isNotNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import { examParticipations, exams } from "@/db/schema"
import { APP_TIME_ZONE } from "@/lib/app-zone"
import { getCurrentSession } from "@/lib/dal"
import { type DashboardPeriod, periodWindow } from "@/lib/dashboard-period"
import { EXAM_HISTORY_PAGE_SIZE } from "@/lib/progression"
import { finalizedDate } from "../exams/dal.shared"
import { readableParticipationScore } from "../exams/dal.student"
import { SUBMITTED } from "../exams/population"
import { hasAccess } from "../payments/dal"
import {
  type LockUser,
  excludeLocked,
  viewerOf,
} from "../questions/answer-key-lock"
import {
  type DomainRevisionCounts,
  getRevisionCountsByDomain,
} from "../training/revision"
import {
  datedAnswersSql,
  latestAnswersSql,
  masteryPercent,
} from "./answers-sql"
import { type RecentParticipation, questionCountOf } from "./dal.dashboard"
import { domainMastery } from "./mastery"

/** Au-delà, la liste dépliée ne se lirait plus ; le référentiel en compte moins. */
const OBJECTIVES_LIMIT = 2000

export type ObjectiveProgress = {
  id: string
  label: string
  /** Questions actives de l'objectif dans ce domaine. */
  total: number
  /** Questions vues : celles qui ont une dernière réponse comptée. */
  covered: number
  /** `null` = aucune question vue ; sous le seuil, l'écran dit « Peu de données ». */
  mastery: number | null
}

export type DomainProgress = {
  domain: string
  /** Questions actives du domaine, clé retenue exclue. */
  total: number
  /** Questions vues (couverture), dénominateur de la maîtrise. */
  answered: number
  /** `null` = domaine jamais pratiqué, jamais 0. */
  mastery: number | null
  /** Écart en points avec la maîtrise au début de la période ; `null` sur « Tout » ou sans maîtrise à ce moment. */
  trend: number | null
  /** Réponses données dans la période, toutes tentatives comptées. */
  periodAnswers: number
  /** Objectifs du CMC du domaine qui ont des questions actives, par libellé. */
  objectives: ObjectiveProgress[]
  /** Compteurs de révision ; `null` sans accès Entraînement. */
  revision: DomainRevisionCounts | null
}

export type MyProgression = {
  domains: DomainProgress[]
  /** Accès Entraînement actif (admin compris) : actions de révision et « Commencer ». */
  trainingAccess: boolean
  activity: {
    /** Journées civiles de l'Est avec une série close ou un examen soumis, dans la période. */
    days: number
    /** Première de ces journées (`YYYY-MM-DD`) ; `null` sans aucune. */
    firstDay: string | null
  }
}

/**
 * Détail de la progression de l'utilisateur courant pour une période : par
 * domaine, maîtrise et tendance, couverture, réponses de la période, objectifs
 * du CMC et compteurs de révision ; jours d'activité. Toute statistique de
 * réponses écarte une question dont la clé est retenue pour lui
 * (`excludeLocked`), dénominateurs compris. `null` sans session.
 */
export const getMyProgression = cache(
  async (period: DashboardPeriod): Promise<MyProgression | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    const viewer = viewerOf(session.user)
    const { from } = periodWindow(period, Date.now())

    const [
      mastery,
      startMastery,
      totals,
      periodAnswers,
      objectives,
      revision,
      activity,
    ] = await Promise.all([
      domainMastery(viewer),
      from ? domainMastery(viewer, from) : null,
      activeQuestionsByDomain(viewer),
      answersByDomain(viewer, from),
      objectiveProgress(viewer),
      hasAccess("training").then((ok) =>
        ok ? getRevisionCountsByDomain(viewer) : null,
      ),
      activityDays(viewer.id, from),
    ])

    const startByDomain = new Map(
      (startMastery ?? []).map((d) => [d.domain, d.mastery]),
    )
    const domains = mastery.map((d): DomainProgress => {
      const start = startByDomain.get(d.domain) ?? null
      return {
        domain: d.domain,
        total: totals.get(d.domain) ?? 0,
        answered: d.answered,
        mastery: d.mastery,
        trend: start === null || d.mastery === null ? null : d.mastery - start,
        periodAnswers: periodAnswers.get(d.domain) ?? 0,
        objectives: objectives.get(d.domain) ?? [],
        revision: revision
          ? (revision.get(d.domain) ?? { failed: 0, unseen: 0, bookmarked: 0 })
          : null,
      }
    })
    return { domains, trainingAccess: revision !== null, activity }
  },
)

/** Questions actives par domaine, sans celles dont la clé est retenue pour `viewer`. */
const activeQuestionsByDomain = async (
  viewer: LockUser,
): Promise<Map<string, number>> => {
  const result = await db.execute<{ domain: string; total: number }>(sql`
    select q.domain, count(*)::int as total
      from questions q
     where q.deleted_at is null
       and ${excludeLocked(viewer, sql`q.id`)}
     group by q.domain`)
  return new Map(result.rows.map((r) => [r.domain, r.total]))
}

/** Réponses datées de la période (toutes depuis toujours sans `from`), par domaine. */
const answersByDomain = async (
  viewer: LockUser,
  from: Date | null,
): Promise<Map<string, number>> => {
  const result = await db.execute<{ domain: string; n: number }>(sql`
    select q.domain, count(*)::int as n
      from (${datedAnswersSql({ userId: viewer.id })}) x
      join questions q on q.id = x.question_id
     where q.deleted_at is null
       ${from ? sql`and x.answered_at >= ${from}` : sql``}
       and ${excludeLocked(viewer, sql`x.question_id`)}
     group by q.domain`)
  return new Map(result.rows.map((r) => [r.domain, r.n]))
}

/**
 * Maîtrise et couverture par objectif du CMC, pour tous les domaines en une
 * requête groupée. Les valeurs invalides du référentiel (`needs_fix`) n'y
 * figurent pas.
 */
const objectiveProgress = async (
  viewer: LockUser,
): Promise<Map<string, ObjectiveProgress[]>> => {
  const result = await db.execute<{
    domain: string
    id: string
    label: string
    total: number
    covered: number
    correct: number
  }>(sql`
    with seen as (
      select l.domain, l.objective_id,
             count(*)::int as covered,
             (count(*) filter (where l.is_correct))::int as correct
        from (${latestAnswersSql(viewer)}) l
       group by l.domain, l.objective_id
    )
    select q.domain, o.id, o.label,
           count(*)::int as total,
           coalesce(s.covered, 0)::int as covered,
           coalesce(s.correct, 0)::int as correct
      from questions q
      join cmc_objectives o on o.id = q.objective_id and not o.needs_fix
      left join seen s on s.domain = q.domain and s.objective_id = q.objective_id
     where q.deleted_at is null
       and ${excludeLocked(viewer, sql`q.id`)}
     group by q.domain, o.id, o.label, s.covered, s.correct
     order by q.domain, o.label, o.id
     limit ${OBJECTIVES_LIMIT}`)

  const byDomain = new Map<string, ObjectiveProgress[]>()
  for (const r of result.rows) {
    const list = byDomain.get(r.domain) ?? []
    list.push({
      id: r.id,
      label: r.label,
      total: r.total,
      covered: r.covered,
      mastery: masteryPercent(r.correct, r.covered),
    })
    byDomain.set(r.domain, list)
  }
  return byDomain
}

/**
 * Jours d'activité : journées civiles de l'Est où l'utilisateur a clos une
 * série ou soumis un examen blanc. Une série seulement commencée ne compte pas.
 */
const activityDays = async (
  userId: string,
  from: Date | null,
): Promise<MyProgression["activity"]> => {
  const since = (column: SQL) => (from ? sql`and ${column} >= ${from}` : sql``)
  const result = await db.execute<{ days: number; first_day: string | null }>(
    sql`
    select count(distinct d)::int as days,
           to_char(min(d), 'YYYY-MM-DD') as first_day
      from (
        select (s.completed_at at time zone ${APP_TIME_ZONE})::date as d
          from training_sessions s
         where s.user_id = ${userId}
           and s.status = 'completed'
           and s.completed_at is not null
           ${since(sql`s.completed_at`)}
        union all
        select (${examParticipations.completedAt} at time zone ${APP_TIME_ZONE})::date
          from ${examParticipations}
         where ${examParticipations.userId} = ${userId}
           and ${SUBMITTED}
           and ${examParticipations.completedAt} is not null
           ${since(sql`${examParticipations.completedAt}`)}
      ) a`,
  )
  const row = result.rows[0]
  return { days: row?.days ?? 0, firstDay: row?.first_day ?? null }
}

// ============================================
// Historique des examens blancs (Progression)
// ============================================

/** Même ligne que les examens récents du tableau de bord. */
export type ExamHistoryRow = RecentParticipation

export type MyExamHistoryPage = {
  items: ExamHistoryRow[]
  /** Rang (base 0) de la première ligne dans tout l'historique. */
  firstIndex: number
  total: number
  /** Curseurs opaques des pages voisines ; `null` au bord de la liste. */
  prevCursor: string | null
  nextCursor: string | null
}

// Curseur keyset = base64("<completedAtISO>|<participationId>").
const encodeCursor = (completedAt: Date, id: string): string =>
  Buffer.from(`${completedAt.toISOString()}|${id}`, "utf8").toString("base64")

const decodeCursor = (
  cursor: string,
): { completedAt: Date; id: string } | null => {
  const decoded = Buffer.from(cursor, "base64").toString("utf8")
  const sep = decoded.indexOf("|")
  if (sep === -1) return null
  const completedAt = new Date(decoded.slice(0, sep))
  const id = decoded.slice(sep + 1)
  if (!id || Number.isNaN(completedAt.getTime())) return null
  return { completedAt, id }
}

/**
 * Toutes les participations soumises de l'utilisateur courant, les plus
 * récentes d'abord, par pages de 10. Pagination keyset dans les deux sens,
 * comme l'historique des transactions : `after` = curseur du bas de la page courante,
 * `before` = celui de son haut. Un score retenu se lit `null`. Page vide sans
 * session.
 */
export const getMyExamHistory = cache(
  async (
    after?: string | null,
    before?: string | null,
  ): Promise<MyExamHistoryPage> => {
    const empty: MyExamHistoryPage = {
      items: [],
      firstIndex: 0,
      total: 0,
      prevCursor: null,
      nextCursor: null,
    }
    const session = await getCurrentSession()
    if (!session?.user) return empty
    const viewer = viewerOf(session.user)

    const afterKey = after ? decodeCursor(after) : null
    const beforeKey = before && !afterKey ? decodeCursor(before) : null
    const key = sql`(${examParticipations.completedAt}, ${examParticipations.id})`
    const mine = and(
      eq(examParticipations.userId, viewer.id),
      SUBMITTED,
      isNotNull(examParticipations.completedAt),
    )

    const rows = await db
      .select({
        id: examParticipations.id,
        examId: examParticipations.examId,
        title: exams.title,
        questionCount: questionCountOf,
        score: readableParticipationScore(viewer),
        completedAt: examParticipations.completedAt,
        endDate: exams.endDate,
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(
        and(
          mine,
          afterKey
            ? sql`${key} < (${afterKey.completedAt}, ${afterKey.id})`
            : undefined,
          beforeKey
            ? sql`${key} > (${beforeKey.completedAt}, ${beforeKey.id})`
            : undefined,
        ),
      )
      .orderBy(
        ...(beforeKey
          ? [asc(examParticipations.completedAt), asc(examParticipations.id)]
          : [
              desc(examParticipations.completedAt),
              desc(examParticipations.id),
            ]),
      )
      .limit(EXAM_HISTORY_PAGE_SIZE)
    if (beforeKey) rows.reverse()

    const first = rows[0]
    const last = rows.at(-1)
    const [position] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        newer: first?.completedAt
          ? sql<number>`count(*) filter (where ${key} > (${first.completedAt}, ${first.id}))`.mapWith(
              Number,
            )
          : sql<number>`0`.mapWith(Number),
      })
      .from(examParticipations)
      .where(mine)
    const firstIndex = position?.newer ?? 0
    const total = position?.total ?? 0

    return {
      items: rows.map((r) => ({
        examId: r.examId,
        title: r.title,
        questionCount: r.questionCount,
        score: r.score,
        completedAt: r.completedAt?.getTime() ?? 0,
        endDate: finalizedDate(r.endDate),
      })),
      firstIndex,
      total,
      prevCursor:
        first?.completedAt && firstIndex > 0
          ? encodeCursor(first.completedAt, first.id)
          : null,
      nextCursor:
        last?.completedAt && firstIndex + rows.length < total
          ? encodeCursor(last.completedAt, last.id)
          : null,
    }
  },
)
