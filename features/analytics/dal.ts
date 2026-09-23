import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { MEDICAL_DOMAINS } from "@/constants"
import { db } from "@/db"
import {
  examParticipations,
  exams,
  products,
  questions,
  transactions,
  user,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { ownerReadableScore } from "../exams/dal.student"
import { excludeLocked, viewerOf } from "../questions/answer-key-lock"

const DAY_MS = 24 * 60 * 60 * 1000

// ============================================
// Fil d'activité récente (dashboard admin)
// ============================================

export type AdminActivity =
  | {
      type: "user_signup"
      timestamp: number
      data: { userName: string; userEmail: string | undefined }
    }
  | {
      type: "payment"
      timestamp: number
      data: {
        userName: string
        amount: number
        currency: string
        productName: string
        paymentType: "stripe" | "manual"
      }
    }
  | {
      type: "exam_completed"
      timestamp: number
      data: { userName: string; examTitle: string; score: number | null }
    }

/**
 * [Admin] 10 dernières activités (inscriptions, paiements complétés, examens
 * complétés). Remplace `analytics.getRecentActivity` : 3 requêtes bornées (5
 * chacune) avec jointures (pas de N+1), fusion puis tri par timestamp desc.
 */
export const getRecentActivity = async (): Promise<AdminActivity[]> => {
  await requireRole(["admin"])

  const [users, payments, completions] = await Promise.all([
    db
      .select({ name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user)
      .where(isNull(user.deletedAt))
      .orderBy(desc(user.createdAt))
      .limit(5),
    db
      .select({
        userName: user.name,
        amount: transactions.amountPaid,
        currency: transactions.currency,
        productName: products.name,
        paymentType: transactions.type,
        completedAt: transactions.completedAt,
      })
      .from(transactions)
      .innerJoin(user, eq(user.id, transactions.userId))
      .leftJoin(products, eq(products.id, transactions.productId))
      .where(
        and(
          eq(transactions.status, "completed"),
          isNotNull(transactions.completedAt),
        ),
      )
      .orderBy(desc(transactions.completedAt))
      .limit(5),
    db
      .select({
        userName: user.name,
        examTitle: exams.title,
        score: examParticipations.score,
        completedAt: examParticipations.completedAt,
      })
      .from(examParticipations)
      .innerJoin(user, eq(user.id, examParticipations.userId))
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(
        and(
          eq(examParticipations.status, "completed"),
          isNotNull(examParticipations.completedAt),
        ),
      )
      .orderBy(desc(examParticipations.completedAt))
      .limit(5),
  ])

  const activities: AdminActivity[] = [
    ...users.map((u) => ({
      type: "user_signup" as const,
      timestamp: u.createdAt.getTime(),
      data: { userName: u.name, userEmail: u.email },
    })),
    ...payments.map((p) => ({
      type: "payment" as const,
      timestamp: p.completedAt?.getTime() ?? 0,
      data: {
        userName: p.userName,
        amount: p.amount,
        currency: p.currency,
        productName: p.productName ?? "Produit",
        paymentType: p.paymentType,
      },
    })),
    ...completions.map((c) => ({
      type: "exam_completed" as const,
      timestamp: c.completedAt?.getTime() ?? 0,
      data: { userName: c.userName, examTitle: c.examTitle, score: c.score },
    })),
  ]

  return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
}

// ============================================
// Tendances 30j (cartes vitales dashboard admin)
// ============================================

export type DashboardTrends = {
  usersTrend: number
  revenueByCurrency: Record<
    string,
    { recent: number; previous: number; trend: number }
  >
  participationsTrend: number
  recentUsersCount: number
  recentParticipationsCount: number
}

// % de variation entre période courante et précédente.
const calculateTrend = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * [Admin] Tendances sur 30 jours vs les 30 jours précédents (utilisateurs,
 * revenus par devise, participations). Remplace `analytics.getDashboardTrends`
 * (qui chargeait 3×2000 lignes en JS) par des agrégats SQL `FILTER` par fenêtre.
 */
export const getDashboardTrends = async (): Promise<DashboardTrends> => {
  await requireRole(["admin"])

  const now = Date.now()
  const d30 = new Date(now - 30 * DAY_MS)
  const d60 = new Date(now - 60 * DAY_MS)

  const [userRow, revRows, partRow] = await Promise.all([
    db
      .select({
        recent:
          sql<number>`count(*) filter (where ${user.createdAt} > ${d30})`.mapWith(
            Number,
          ),
        previous:
          sql<number>`count(*) filter (where ${user.createdAt} > ${d60} and ${user.createdAt} <= ${d30})`.mapWith(
            Number,
          ),
      })
      .from(user)
      .where(isNull(user.deletedAt)),
    db
      .select({
        currency: transactions.currency,
        recent:
          sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.completedAt} > ${d30}), 0)`.mapWith(
            Number,
          ),
        previous:
          sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.completedAt} > ${d60} and ${transactions.completedAt} <= ${d30}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(eq(transactions.status, "completed"))
      .groupBy(transactions.currency),
    db
      .select({
        recent:
          sql<number>`count(*) filter (where ${examParticipations.completedAt} > ${d30})`.mapWith(
            Number,
          ),
        previous:
          sql<number>`count(*) filter (where ${examParticipations.completedAt} > ${d60} and ${examParticipations.completedAt} <= ${d30})`.mapWith(
            Number,
          ),
      })
      .from(examParticipations)
      .where(eq(examParticipations.status, "completed")),
  ])

  const recentUsersCount = userRow[0]?.recent ?? 0
  const previousUsersCount = userRow[0]?.previous ?? 0

  const revenueByCurrency: Record<
    string,
    { recent: number; previous: number; trend: number }
  > = {
    CAD: { recent: 0, previous: 0, trend: 0 },
    XAF: { recent: 0, previous: 0, trend: 0 },
  }
  for (const r of revRows) {
    revenueByCurrency[r.currency] = {
      recent: r.recent,
      previous: r.previous,
      trend: round1(calculateTrend(r.recent, r.previous)),
    }
  }

  const recentParticipationsCount = partRow[0]?.recent ?? 0
  const previousParticipationsCount = partRow[0]?.previous ?? 0

  return {
    usersTrend: round1(calculateTrend(recentUsersCount, previousUsersCount)),
    revenueByCurrency,
    participationsTrend: round1(
      calculateTrend(recentParticipationsCount, previousParticipationsCount),
    ),
    recentUsersCount,
    recentParticipationsCount,
  }
}

// ============================================
// Paiements échoués récents (alerte dashboard)
// ============================================

/** [Admin] Nombre de transactions échouées des 7 derniers jours. Remplace
 * `analytics.getFailedPaymentsCount`. */
export const getFailedPaymentsCount = async (): Promise<number> => {
  await requireRole(["admin"])

  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS)
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "failed"),
        gt(transactions.createdAt, sevenDaysAgo),
      ),
    )

  return row?.n ?? 0
}

// ============================================
// Percentile d'examen
// ============================================

/** En dessous de ce nombre de participations lisibles, pas de percentile. */
export const PERCENTILE_MIN_COHORT = 5

/** Percentile d'examen par id d'examen ; `null` = non disponible. */
export type ExamPercentiles = Record<string, number | null>

/**
 * Percentiles des participations de `userId` aux examens clos (tous, ou ceux
 * de `examIds`). Le groupe de pairs est celui du classement, restreint aux
 * comptes étudiants non supprimés, et lu par la même retenue
 * (`ownerReadableScore`) : une participation au score retenu n'est ni cible
 * ni pair.
 */
const percentilesOf = async (
  userId: string,
  examIds?: string[],
): Promise<ExamPercentiles> => {
  const cohort = db
    .select({
      id: examParticipations.id,
      examId: examParticipations.examId,
      userId: examParticipations.userId,
      score: ownerReadableScore,
    })
    .from(examParticipations)
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .innerJoin(user, eq(user.id, examParticipations.userId))
    .where(
      and(
        lte(exams.endDate, new Date()),
        inArray(examParticipations.status, ["completed", "auto_submitted"]),
        eq(user.role, "user"),
        isNull(user.deletedAt),
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
    select t.exam_id,
           case
             when t.score is null
               or count(o.score) < ${PERCENTILE_MIN_COHORT} then null
             else round(
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

/** Percentiles de l'utilisateur courant, par examen. `{}` sans session. */
export const getMyExamPercentiles = cache(
  async (): Promise<ExamPercentiles> => {
    const session = await getCurrentSession()
    if (!session?.user) return {}
    return percentilesOf(session.user.id)
  },
)

/** [Admin] Percentile d'un étudiant à un examen ; `null` si non disponible. */
export const getExamPercentileForUser = async (
  examId: string,
  userId: string,
): Promise<number | null> => {
  await requireRole(["admin"])
  return (await percentilesOf(userId, [examId]))[examId] ?? null
}

// ============================================
// Maîtrise par domaine
// ============================================

export type DomainMastery = {
  domain: string
  /** Questions comptées : la dernière réponse de l'étudiant à chacune. */
  answered: number
  /** Part de justes, en % ; `null` = domaine jamais pratiqué, jamais 0. */
  mastery: number | null
}

/**
 * Maîtrise de l'utilisateur courant pour chaque domaine médical, sur sa
 * DERNIÈRE réponse à chaque question (entraînement et examens clos). Une
 * réponse d'examen est datée de la clôture de sa participation. Une question
 * dont la clé est retenue pour lui est écartée tout entière (`excludeLocked`) :
 * la maîtrise ne bouge pas tant que l'examen est ouvert, rien ne se déduit
 * par soustraction. `[]` sans session.
 */
export const getMyDomainMastery = cache(async (): Promise<DomainMastery[]> => {
  const session = await getCurrentSession()
  if (!session?.user) return []
  const uid = session.user.id

  const result = await db.execute<{
    domain: string
    answered: number
    correct: number
  }>(sql`
      with answers as (
        select i.question_id, i.is_correct, i.answered_at as answered_at
          from training_session_items i
          join training_sessions s on s.id = i.session_id
         where s.user_id = ${uid}
           and i.is_correct is not null
        union all
        select a.question_id, a.is_correct, p.completed_at
          from exam_answers a
          join exam_participations p on p.id = a.participation_id
         where p.user_id = ${uid}
           and p.completed_at is not null
           and a.is_correct is not null
      ),
      latest as (
        select distinct on (question_id) question_id, is_correct
          from answers
         order by question_id, answered_at desc
      )
      select q.domain,
             count(*)::int as answered,
             (count(*) filter (where l.is_correct))::int as correct
        from latest l
        join questions q on q.id = l.question_id
       where q.deleted_at is null
         and ${excludeLocked(viewerOf(session.user), sql`l.question_id`)}
       group by q.domain`)

  const byDomain = new Map(result.rows.map((r) => [r.domain, r]))
  return MEDICAL_DOMAINS.map((domain) => {
    const row = byDomain.get(domain)
    return {
      domain,
      answered: row?.answered ?? 0,
      mastery: row ? Math.round((100 * row.correct) / row.answered) : null,
    }
  })
})

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
const firstAnswersSql = (questionIds?: string[]) => sql`
  select distinct on (x.user_id, x.question_id)
         x.question_id, x.selected_answer
    from (
      select s.user_id, i.question_id, i.selected_answer, i.answered_at as at
        from training_session_items i
        join training_sessions s on s.id = i.session_id
       where i.is_correct is not null
      union all
      select p.user_id, a.question_id, a.selected_answer, p.completed_at
        from exam_answers a
        join exam_participations p on p.id = a.participation_id
       where a.is_correct is not null
         and p.completed_at is not null
    ) x
    join "user" u on u.id = x.user_id
   where u.role = 'user'
     and u.deleted_at is null
     ${questionIds ? sql`and ${inArray(sql`x.question_id`, questionIds)}` : sql``}
   order by x.user_id, x.question_id, x.at`

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

export type QuestionAnswerBreakdown = {
  answerCount: number
  /** `null` sous le seuil de signification. */
  successRate: number | null
  /** Options dans l'ordre de la question ; `share` en % des réponses comptées. */
  options: { option: string; count: number; share: number; isKey: boolean }[]
}

/**
 * [Admin] Répartition des premières réponses d'étudiants entre les options
 * d'une question. Réservée aux admins : pour un étudiant, elle livrerait la
 * clé. Mêmes réponses comptées que le taux de réussite.
 */
export const getQuestionAnswerBreakdown = async (
  questionId: string,
): Promise<QuestionAnswerBreakdown> => {
  await requireRole(["admin"])

  const [question] = await db
    .select({
      options: questions.options,
      correctAnswer: questions.correctAnswer,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1)
  if (!question) return { answerCount: 0, successRate: null, options: [] }

  const counts = await db.execute<{ selected_answer: string; n: number }>(sql`
    select f.selected_answer, count(*)::int as n
      from (${firstAnswersSql([questionId])}) f
     group by f.selected_answer`)

  const byOption = new Map(counts.rows.map((r) => [r.selected_answer, r.n]))
  const answerCount = counts.rows.reduce((sum, r) => sum + r.n, 0)
  const share = (n: number) =>
    answerCount === 0 ? 0 : Math.round((100 * n) / answerCount)
  const keyCount = byOption.get(question.correctAnswer) ?? 0

  return {
    answerCount,
    successRate:
      answerCount >= QUESTION_SUCCESS_MIN_ANSWERS ? share(keyCount) : null,
    options: question.options.map((option) => ({
      option,
      count: byOption.get(option) ?? 0,
      share: share(byOption.get(option) ?? 0),
      isKey: option === question.correctAnswer,
    })),
  }
}
