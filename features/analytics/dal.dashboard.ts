import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  products,
  trainingSessions,
  transactions,
} from "@/db/schema"
import { APP_TIME_ZONE } from "@/lib/app-zone"
import type { AttemptTiming } from "@/lib/attempt-clock"
import { getCurrentSession } from "@/lib/dal"
import { type DashboardPeriod, periodWindow } from "@/lib/dashboard-period"
import { PASS_THRESHOLD } from "@/lib/score"
import {
  memberAudienceWhere,
  participationScoreReadable,
  readableParticipationScore,
} from "../exams/dal.student"
import { DEFAULT_PAUSE_MINUTES } from "../exams/schemas"
import { hasAccess } from "../payments/dal"
import { viewerOf } from "../questions/answer-key-lock"
import { sessionScoreReadable } from "../training/dal"

/** `mapWith(Number)` ferait de `null` un `0` — faux « 0 % » quand rien n'est lisible. */
const nullableNumber = (v: unknown) => (v === null ? null : Number(v))

const CLOSED = ["completed", "auto_submitted"] as const

/** Au-delà, la courbe deviendrait illisible ; les plus récents sont gardés. */
const HISTORY_LIMIT = 50
/** Un peu plus d'un an de semaines. */
const WEEKS_LIMIT = 60

export type ExamHistoryPoint = {
  examId: string
  title: string
  score: number
  completedAt: number
}

export type TrainingWeek = {
  /** Lundi de la semaine, journée civile de l'Est (`YYYY-MM-DD`). */
  weekStart: string
  averageScore: number
  /** Séries au score lisible de la semaine. */
  sessionCount: number
}

export type MyDashboard = {
  exams: {
    /** Moyenne des scores lisibles de la période ; `null` = aucun. */
    averageScore: number | null
    /** Écart en points avec la période précédente de même durée ; `null` sur « Tout » ou sans l'une des deux moyennes. */
    averageTrend: number | null
    /** Participations soumises, toutes périodes — même sur un examen encore ouvert. */
    completedCount: number
    /** Examens actifs accessibles, toutes périodes ; 0 sans accès Examens. */
    availableCount: number
    /** Participations au score lisible, toutes périodes. */
    gradedCount: number
    /** Parmi elles, celles au seuil de réussite ou au-dessus. */
    passedCount: number
    /** Moyenne de toutes les participations au score lisible ; `null` = aucune. */
    overallAverage: number | null
    /** Scores lisibles de la période, du plus ancien au plus récent. */
    history: ExamHistoryPoint[]
  }
  training: {
    /** Séries closes de la période ; une série en cours n'en est pas une. */
    sessionCount: number
    /** Questions tirées par ces séries. */
    questionCount: number
    /** Moyenne hebdomadaire des séries closes ; une semaine sans série lisible n'a pas de point. */
    weekly: TrainingWeek[]
  }
  /** Au moins une participation soumise ou une série close, toutes périodes. */
  hasHistory: boolean
}

/**
 * Tableau de bord de l'utilisateur courant pour une période. Un score retenu
 * (examen encore ouvert, réponse différée) n'entre dans aucune moyenne ni
 * aucun compte de réussite : avant/après le restituerait. `null` sans session.
 */
export const getMyDashboard = cache(
  async (period: DashboardPeriod): Promise<MyDashboard | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    const uid = session.user.id
    const viewer = viewerOf(session.user)
    const { from, previousFrom } = periodWindow(period, Date.now())

    const graded = participationScoreReadable(viewer)
    const inPeriod = from
      ? sql`${examParticipations.completedAt} >= ${from}`
      : sql`true`
    const inPrevious =
      from && previousFrom
        ? sql`${examParticipations.completedAt} >= ${previousFrom} and ${examParticipations.completedAt} < ${from}`
        : sql`false`
    const mine = and(
      eq(examParticipations.userId, uid),
      inArray(examParticipations.status, [...CLOSED]),
    )

    const readableSession = sessionScoreReadable(viewer)
    const sessionInPeriod = from
      ? sql`${trainingSessions.completedAt} >= ${from}`
      : sql`true`
    const closedSessions = and(
      eq(trainingSessions.userId, uid),
      eq(trainingSessions.status, "completed"),
      isNotNull(trainingSessions.completedAt),
      sessionInPeriod,
    )
    // Lundi de la semaine CIVILE de l'Est : `date_trunc` sur l'heure locale,
    // pas sur l'instant UTC, sinon un dimanche soir tomberait dans la semaine
    // suivante.
    const weekStart = sql<string>`to_char(date_trunc('week', ${trainingSessions.completedAt} at time zone ${APP_TIME_ZONE}), 'YYYY-MM-DD')`

    const [[exam], history, availableCount, [training], weekly, [anySeries]] =
      await Promise.all([
        db
          .select({
            averageScore: sql<
              number | null
            >`round(avg(${examParticipations.score}) filter (where ${graded} and ${inPeriod}))`.mapWith(
              nullableNumber,
            ),
            previousAverage: sql<
              number | null
            >`round(avg(${examParticipations.score}) filter (where ${graded} and ${inPrevious}))`.mapWith(
              nullableNumber,
            ),
            completedCount: sql<number>`count(*)`.mapWith(Number),
            gradedCount: sql<number>`count(*) filter (where ${graded})`.mapWith(
              Number,
            ),
            passedCount:
              sql<number>`count(*) filter (where ${graded} and ${examParticipations.score} >= ${PASS_THRESHOLD})`.mapWith(
                Number,
              ),
            overallAverage: sql<
              number | null
            >`round(avg(${examParticipations.score}) filter (where ${graded}))`.mapWith(
              nullableNumber,
            ),
          })
          .from(examParticipations)
          .where(mine),
        db
          .select({
            examId: examParticipations.examId,
            title: exams.title,
            score: examParticipations.score,
            completedAt: examParticipations.completedAt,
          })
          .from(examParticipations)
          .innerJoin(exams, eq(exams.id, examParticipations.examId))
          .where(and(mine, graded, inPeriod))
          .orderBy(
            desc(examParticipations.completedAt),
            desc(examParticipations.id),
          )
          .limit(HISTORY_LIMIT),
        countAvailableExams(uid),
        db
          .select({
            sessionCount: sql<number>`count(*)`.mapWith(Number),
            questionCount:
              sql<number>`coalesce(sum(${trainingSessions.questionCount}), 0)`.mapWith(
                Number,
              ),
          })
          .from(trainingSessions)
          .where(closedSessions),
        db
          .select({
            weekStart,
            averageScore:
              sql<number>`round(avg(${trainingSessions.score}) filter (where ${readableSession}))`.mapWith(
                Number,
              ),
            sessionCount:
              sql<number>`count(${trainingSessions.score}) filter (where ${readableSession})`.mapWith(
                Number,
              ),
          })
          .from(trainingSessions)
          .where(closedSessions)
          .groupBy(sql`1`)
          .having(
            sql`count(${trainingSessions.score}) filter (where ${readableSession}) > 0`,
          )
          .orderBy(sql`1 desc`)
          .limit(WEEKS_LIMIT),
        db
          .select({ id: trainingSessions.id })
          .from(trainingSessions)
          .where(
            and(
              eq(trainingSessions.userId, uid),
              eq(trainingSessions.status, "completed"),
            ),
          )
          .limit(1),
      ])

    const averageScore = exam?.averageScore ?? null
    const previousAverage = exam?.previousAverage ?? null

    return {
      exams: {
        averageScore,
        averageTrend:
          averageScore !== null && previousAverage !== null
            ? averageScore - previousAverage
            : null,
        completedCount: exam?.completedCount ?? 0,
        availableCount,
        gradedCount: exam?.gradedCount ?? 0,
        passedCount: exam?.passedCount ?? 0,
        overallAverage: exam?.overallAverage ?? null,
        history: history.reverse().flatMap((h) =>
          h.score === null || !h.completedAt
            ? []
            : [
                {
                  examId: h.examId,
                  title: h.title,
                  score: h.score,
                  completedAt: h.completedAt.getTime(),
                },
              ],
        ),
      },
      training: {
        sessionCount: training?.sessionCount ?? 0,
        questionCount: training?.questionCount ?? 0,
        weekly: weekly.reverse(),
      },
      hasHistory: (exam?.completedCount ?? 0) > 0 || anySeries !== undefined,
    }
  },
)

/**
 * Examens actifs que l'utilisateur peut passer, sans filtre de fenêtre :
 * ouverts aux abonnés, ou restreints dont il est membre. Entitlement réel
 * (`hasAccess` avec `userId`) : un admin sans accès acheté n'en voit aucun.
 */
const countAvailableExams = async (uid: string): Promise<number> => {
  if (!(await hasAccess("exam", uid))) return 0
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(exams)
    .where(and(eq(exams.isActive, true), memberAudienceWhere(uid)))
  return row?.n ?? 0
}

const questionCountOf =
  sql<number>`(select count(*) from ${examQuestions} where ${examQuestions.examId} = ${exams.id})`.mapWith(
    Number,
  )

export type RecentParticipation = {
  examId: string
  title: string
  questionCount: number
  /** `null` = score retenu (examen encore ouvert, réponse différée). */
  score: number | null
  completedAt: number
  /** Fin de la fenêtre de l'examen : les résultats ne se lisent qu'après. */
  endDate: number
}

/** Cinq dernières participations soumises de l'utilisateur courant. `[]` sans session. */
export const getMyRecentParticipations = cache(
  async (): Promise<RecentParticipation[]> => {
    const session = await getCurrentSession()
    if (!session?.user) return []
    const rows = await db
      .select({
        examId: examParticipations.examId,
        title: exams.title,
        questionCount: questionCountOf,
        score: readableParticipationScore(viewerOf(session.user)),
        completedAt: examParticipations.completedAt,
        endDate: exams.endDate,
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(
        and(
          eq(examParticipations.userId, session.user.id),
          inArray(examParticipations.status, [...CLOSED]),
          isNotNull(examParticipations.completedAt),
        ),
      )
      .orderBy(
        desc(examParticipations.completedAt),
        desc(examParticipations.id),
      )
      .limit(5)
    return rows.map((r) => ({
      ...r,
      completedAt: r.completedAt?.getTime() ?? 0,
      endDate: r.endDate.getTime(),
    }))
  },
)

const ACTIVITY_LIMIT = 6

export type ActivityItem =
  | {
      kind: "exam"
      id: string
      title: string
      questionCount: number
      score: number | null
      at: number
    }
  | {
      kind: "series"
      id: string
      /** `null` = tous domaines. */
      domain: string | null
      questionCount: number
      score: number | null
      at: number
    }
  | { kind: "purchase"; id: string; product: string | null; at: number }

/**
 * Dernières actions de l'utilisateur courant : participations soumises,
 * séries closes et achats complétés. Trois lectures bornées, fusionnées ici ;
 * une série en cours n'y figure pas (sa justesse reste cachée jusqu'à la fin).
 */
export const getMyRecentActivity = cache(async (): Promise<ActivityItem[]> => {
  const session = await getCurrentSession()
  if (!session?.user) return []
  const uid = session.user.id
  const viewer = viewerOf(session.user)

  const [examRows, seriesRows, purchaseRows] = await Promise.all([
    db
      .select({
        id: examParticipations.id,
        title: exams.title,
        questionCount: questionCountOf,
        score: readableParticipationScore(viewer),
        at: examParticipations.completedAt,
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(
        and(
          eq(examParticipations.userId, uid),
          inArray(examParticipations.status, [...CLOSED]),
          isNotNull(examParticipations.completedAt),
        ),
      )
      .orderBy(
        desc(examParticipations.completedAt),
        desc(examParticipations.id),
      )
      .limit(ACTIVITY_LIMIT),
    db
      .select({
        id: trainingSessions.id,
        domain: trainingSessions.domain,
        questionCount: trainingSessions.questionCount,
        score: sql<
          number | null
        >`case when ${sessionScoreReadable(viewer)} then ${trainingSessions.score} end`,
        at: trainingSessions.completedAt,
      })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, uid),
          eq(trainingSessions.status, "completed"),
          isNotNull(trainingSessions.completedAt),
        ),
      )
      .orderBy(desc(trainingSessions.completedAt), desc(trainingSessions.id))
      .limit(ACTIVITY_LIMIT),
    db
      .select({
        id: transactions.id,
        product: products.name,
        completedAt: transactions.completedAt,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(products, eq(products.id, transactions.productId))
      .where(
        and(eq(transactions.userId, uid), eq(transactions.status, "completed")),
      )
      .orderBy(desc(transactions.createdAt), desc(transactions.id))
      .limit(ACTIVITY_LIMIT),
  ])

  const items: ActivityItem[] = [
    ...examRows.map((r) => ({
      kind: "exam" as const,
      id: r.id,
      title: r.title,
      questionCount: r.questionCount,
      score: r.score,
      at: r.at?.getTime() ?? 0,
    })),
    ...seriesRows.map((r) => ({
      kind: "series" as const,
      id: r.id,
      domain: r.domain,
      questionCount: r.questionCount,
      score: r.score,
      at: r.at?.getTime() ?? 0,
    })),
    ...purchaseRows.map((r) => ({
      kind: "purchase" as const,
      id: r.id,
      product: r.product,
      at: (r.completedAt ?? r.createdAt).getTime(),
    })),
  ]
  return items
    .toSorted((a, b) => b.at - a.at || a.id.localeCompare(b.id))
    .slice(0, ACTIVITY_LIMIT)
})

export type ExamInProgress = {
  examId: string
  title: string
  answeredCount: number
  questionCount: number
  /** De quoi calculer le temps restant depuis l'horloge ancrée du rendu. */
  timing: AttemptTiming
}

/**
 * Participation démarrée et encore ouverte de l'utilisateur courant, sur un
 * examen dont la fenêtre court toujours ; la plus récente s'il y en a
 * plusieurs. `null` sinon.
 */
export const getMyExamInProgress = cache(
  async (): Promise<ExamInProgress | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    const [row] = await db
      .select({
        examId: exams.id,
        title: exams.title,
        questionCount: questionCountOf,
        answeredCount:
          sql<number>`(select count(*) from ${examAnswers} where ${examAnswers.participationId} = ${examParticipations.id} and ${examAnswers.selectedAnswer} is not null and ${examAnswers.selectedAnswer} <> '')`.mapWith(
            Number,
          ),
        startedAt: examParticipations.startedAt,
        completionTime: exams.completionTime,
        totalPauseDurationMs: examParticipations.totalPauseDurationMs,
        pauseStartedAt: examParticipations.pauseStartedAt,
        pauseDurationMinutes: exams.pauseDurationMinutes,
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(
        and(
          eq(examParticipations.userId, session.user.id),
          eq(examParticipations.status, "in_progress"),
          isNotNull(examParticipations.startedAt),
          sql`${exams.endDate} > now()`,
        ),
      )
      .orderBy(desc(examParticipations.startedAt), desc(examParticipations.id))
      .limit(1)
    if (!row?.startedAt) return null
    return {
      examId: row.examId,
      title: row.title,
      answeredCount: row.answeredCount,
      questionCount: row.questionCount,
      timing: {
        startedAt: row.startedAt.getTime(),
        budgetSeconds: row.completionTime,
        pauseCreditMs: Number(row.totalPauseDurationMs ?? 0),
        pauseInProgress: row.pauseStartedAt
          ? {
              startedAt: row.pauseStartedAt.getTime(),
              capMinutes: row.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
            }
          : null,
      },
    }
  },
)
