import { and, eq, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import { examParticipations, trainingSessions, user } from "@/db/schema"
import { STUDENT_PROGRESS_PAGE_SIZE } from "@/lib/admin-progression"
import { requireRole } from "@/lib/auth-guards"
import { type DashboardPeriod, periodWindow } from "@/lib/dashboard-period"
import { ownerParticipationScoreReadable } from "../exams/dal.student"
import { populationAccount } from "../exams/population"
import { viewerOf } from "../questions/answer-key-lock"
import { type ExamPercentiles, percentilesOf } from "./dal"
import {
  type MyDashboard,
  dashboardOf,
  examBandSql,
  trainingBandSql,
} from "./dal.dashboard"
import {
  type MyExamHistoryPage,
  type MyProgression,
  activityDaySql,
  activityEventsSql,
  examHistoryOf,
  progressionOf,
} from "./dal.progression"

// ============================================
// [Admin] Tableau de suivi
// ============================================

/** Le meilleur des deux accès : actif si l'un l'est, expiré si l'un a existé. */
export type StudentAccess = "active" | "expired" | "none"

export type StudentProgressSort =
  "lastActivity" | "score" | "passed" | "questions" | "days"

export type StudentProgressFilters = {
  search?: string
  access?: StudentAccess
  /** Au moins un jour d'activité sur la période. */
  activeOnly?: boolean
  period: DashboardPeriod
  sortBy: StudentProgressSort
  sortOrder: "asc" | "desc"
}

export type StudentProgressRow = StudentIdentity & {
  access: StudentAccess
  /** Les chiffres de la bande de sa page, sur la période ; `null` = « — ». */
  averageScore: number | null
  averageTrend: number | null
  /** `null` sans examen noté sur la période. */
  examsPassed: number | null
  examsGraded: number | null
  /** `null` pour un étudiant sans aucune activité, toutes périodes. */
  questionCount: number | null
  activityDays: number | null
  /** Epoch ms, toutes périodes : c'est elle qui montre qu'un étudiant décroche. */
  lastActivityAt: number | null
}

export type StudentProgressPage = {
  items: StudentProgressRow[]
  total: number
}

export type StudentProgressNeighbors = {
  /** 1-based. */
  position: number
  total: number
  previousId: string | null
  nextId: string | null
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

const SORT_COLUMN: Record<StudentProgressSort, string> = {
  lastActivity: "last_activity_at",
  score: "average_score",
  passed: "exams_passed",
  questions: "question_count",
  days: "activity_days",
}

/**
 * Une ligne par étudiant de la population, avec les chiffres de la bande de
 * sa page Progression pour la période. Les fragments viennent de son tableau
 * de bord et de sa progression : un chiffre n'a qu'une définition.
 */
const studentRowsSql = (f: StudentProgressFilters, now: number) => {
  const { from, previousFrom } = periodWindow(f.period, now)
  const at = new Date(now)
  const band = examBandSql({
    graded: ownerParticipationScoreReadable,
    from,
    previousFrom,
  })
  const training = trainingBandSql(from)
  const term = f.search?.trim()
  const pattern = term ? `%${escapeLike(term)}%` : null

  return sql`
    select * from (
      select ${user.id} as id, ${user.name} as name, ${user.email} as email,
             ${user.image} as image, ${user.banned} as banned,
             case when ea.expires_at > ${at} or ta.expires_at > ${at} then 'active'
                  when ea.id is not null or ta.id is not null then 'expired'
                  else 'none' end as access,
             ex.average_score, ex.average_trend,
             nullif(ex.graded, 0) as exams_graded,
             case when ex.graded > 0 then ex.passed end as exams_passed,
             case when act.last_at is not null then coalesce(tr.questions, 0) end as question_count,
             act.days as activity_days,
             act.last_at as last_activity_at
        from ${user}
        left join user_access ea on ea.user_id = ${user.id} and ea.access_type = 'exam'
        left join user_access ta on ta.user_id = ${user.id} and ta.access_type = 'training'
        left join (
          select ${examParticipations.userId} as user_id,
                 (${band.averageScore})::int as average_score,
                 (${band.averageTrend})::int as average_trend,
                 (${band.periodGradedCount})::int as graded,
                 (${band.periodPassedCount})::int as passed
            from ${examParticipations}
           where ${band.closed}
           group by ${examParticipations.userId}
        ) ex on ex.user_id = ${user.id}
        left join (
          select ${trainingSessions.userId} as user_id,
                 (${training.questionCount})::int as questions
            from ${trainingSessions}
           where ${training.closed} and ${training.inPeriod}
           group by ${trainingSessions.userId}
        ) tr on tr.user_id = ${user.id}
        left join (
          select e.user_id,
                 (count(distinct ${activityDaySql(sql`e.at`)})
                    ${from ? sql`filter (where e.at >= ${from})` : sql``})::int as days,
                 max(e.at) as last_at
            from (${activityEventsSql()}) e
           group by e.user_id
        ) act on act.user_id = ${user.id}
       where ${populationAccount}
         ${pattern ? sql`and (${user.name} ilike ${pattern} or ${user.email} ilike ${pattern})` : sql``}
    ) p
    where true
      ${f.access ? sql`and p.access = ${f.access}` : sql``}
      ${f.activeOnly ? sql`and p.activity_days > 0` : sql``}`
}

/**
 * Ordre du tableau : une valeur absente passe toujours en dernier, quel que
 * soit le sens ; à égalité, par nom puis identifiant (ordre stable entre les
 * pages et pour les voisins).
 */
const rowsOrderSql = (f: StudentProgressFilters) => {
  const column = sql.raw(`s.${SORT_COLUMN[f.sortBy]}`)
  const dir = sql.raw(f.sortOrder === "asc" ? "asc" : "desc")
  return sql`(${column} is null), ${column} ${dir}${
    f.sortBy === "passed" ? sql`, s.exams_graded ${dir}` : sql``
  }, lower(s.name), s.id`
}

type RawRow = {
  id: string
  name: string
  email: string
  image: string | null
  banned: boolean
  access: StudentAccess
  average_score: number | null
  average_trend: number | null
  exams_graded: number | null
  exams_passed: number | null
  question_count: number | null
  activity_days: number | null
  last_activity_at: Date | string | null
}

/**
 * [Admin] Tableau de suivi de la progression, trié et borné en SQL : 20
 * lignes par offset, une requête agrégée pour la page et une pour le total.
 */
export const getStudentProgressList = async ({
  offset = 0,
  ...filters
}: StudentProgressFilters & {
  offset?: number
}): Promise<StudentProgressPage> => {
  await requireRole(["admin"])
  const rows = studentRowsSql(filters, Date.now())
  const safeOffset = Math.max(0, Math.floor(offset))

  const [page, count] = await Promise.all([
    db.execute<RawRow>(sql`
      select * from (${rows}) s
       order by ${rowsOrderSql(filters)}
       limit ${STUDENT_PROGRESS_PAGE_SIZE} offset ${safeOffset}`),
    db.execute<{ total: number }>(
      sql`select count(*)::int as total from (${rows}) s`,
    ),
  ])

  return {
    items: page.rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      image: r.image,
      banned: r.banned,
      access: r.access,
      averageScore: r.average_score,
      averageTrend: r.average_trend,
      examsPassed: r.exams_passed,
      examsGraded: r.exams_graded,
      questionCount: r.question_count,
      activityDays: r.activity_days,
      lastActivityAt: r.last_activity_at
        ? new Date(r.last_activity_at).getTime()
        : null,
    })),
    total: count.rows[0]?.total ?? 0,
  }
}

/**
 * [Admin] Place d'un étudiant dans le tableau filtré et trié (mêmes filtres,
 * même ordre, même période) et ses voisins, à travers les pages. `null` s'il
 * n'y figure pas.
 */
export const getStudentProgressNeighbors = async (
  studentId: string,
  filters: StudentProgressFilters,
): Promise<StudentProgressNeighbors | null> => {
  await requireRole(["admin"])
  const order = rowsOrderSql(filters)
  const result = await db.execute<{
    position: number
    total: number
    previous_id: string | null
    next_id: string | null
  }>(sql`
    select r.position, r.total, r.previous_id, r.next_id
      from (
        select s.id,
               (row_number() over (order by ${order}))::int as position,
               lag(s.id) over (order by ${order}) as previous_id,
               lead(s.id) over (order by ${order}) as next_id,
               (count(*) over ())::int as total
          from (${studentRowsSql(filters, Date.now())}) s
      ) r
     where r.id = ${studentId}`)
  const row = result.rows[0]
  if (!row) return null
  return {
    position: row.position,
    total: row.total,
    previousId: row.previous_id,
    nextId: row.next_id,
  }
}

// ============================================
// [Admin] Progression d'un étudiant
// ============================================

export type StudentIdentity = {
  id: string
  name: string
  email: string
  image: string | null
  banned: boolean
}

export type StudentProgress = {
  student: StudentIdentity
  dashboard: MyDashboard
  progression: MyProgression
  history: MyExamHistoryPage
  percentiles: ExamPercentiles
}

/**
 * [Admin] Progression d'un étudiant telle qu'il la lit lui-même : les mêmes
 * lectures que sa page, avec lui pour lecteur. Un score ou une clé retenus
 * pour lui le restent ici ; le score brut vit dans la fiche et la copie.
 * `null` pour un compte inconnu, admin ou supprimé.
 */
export const getStudentProgress = cache(
  async (
    studentId: string,
    period: DashboardPeriod,
    after?: string | null,
    before?: string | null,
  ): Promise<StudentProgress | null> => {
    await requireRole(["admin"])

    const [student] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        banned: user.banned,
        role: user.role,
      })
      .from(user)
      .where(and(eq(user.id, studentId), populationAccount))
      .limit(1)
    if (!student) return null
    const viewer = viewerOf(student)

    const [dashboard, progression, history] = await Promise.all([
      dashboardOf(viewer, period),
      progressionOf(viewer, period),
      examHistoryOf(viewer, after, before),
    ])
    const examIds = history.items.map((i) => i.examId)
    const percentiles =
      examIds.length === 0 ? {} : await percentilesOf(viewer.id, examIds)

    return {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        image: student.image,
        banned: student.banned,
      },
      dashboard,
      progression,
      history,
      percentiles,
    }
  },
)
