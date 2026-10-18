import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
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
import { type SubmittedStatus, submittedStatus } from "../exams/dal.shared"
import { SUBMITTED } from "../exams/population"
import { viewerOf } from "../questions/answer-key-lock"
import { firstAnswersSql, questionSuccessStats } from "./answers-sql"
import { type ExamPercentiles, percentilesOf } from "./dal.percentiles"
import { type DomainMastery, domainMastery } from "./mastery"

// Liste explicite, sans `export *` : les lectures paramétrées par l'étudiant
// (les `…Of`) n'ont pas de garde et ne passent pas par ce module, que les
// pages importent.
export {
  type ActivityItem,
  type ExamHistoryPoint,
  type ExamInProgress,
  type MyDashboard,
  type RecentParticipation,
  type TrainingWeek,
  getMyDashboard,
  getMyExamInProgress,
  getMyRecentActivity,
  getMyRecentParticipations,
  questionCountOf,
} from "./dal.dashboard"
export {
  type DomainProgress,
  type ExamHistoryRow,
  type MyExamHistoryPage,
  type MyProgression,
  type ObjectiveProgress,
  getMyExamHistory,
  getMyProgression,
} from "./dal.progression"
export { type ExamPercentiles, PERCENTILE_MIN_COHORT } from "./dal.percentiles"

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
      type: "exam_submitted"
      timestamp: number
      data: {
        userName: string
        examTitle: string
        score: number | null
        status: SubmittedStatus
      }
    }

/**
 * [Admin] 10 dernières activités (inscriptions, paiements complétés, copies
 * d'examen soumises, à la main ou automatiquement) : 3 requêtes bornées (5
 * chacune) avec jointures (pas de N+1), fusion puis tri par timestamp desc.
 */
export const getRecentActivity = async (): Promise<AdminActivity[]> => {
  await requireRole(["admin"])

  const [users, payments, submissions] = await Promise.all([
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
        status: examParticipations.status,
        completedAt: examParticipations.completedAt,
      })
      .from(examParticipations)
      .innerJoin(user, eq(user.id, examParticipations.userId))
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(and(SUBMITTED, isNotNull(examParticipations.completedAt)))
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
    ...submissions.map((s) => ({
      type: "exam_submitted" as const,
      timestamp: s.completedAt?.getTime() ?? 0,
      data: {
        userName: s.userName,
        examTitle: s.examTitle,
        score: s.score,
        status: submittedStatus(s.status),
      },
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
  recentUsersCount: number
}

// % de variation entre période courante et précédente.
const calculateTrend = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * [Admin] Tendances sur 30 jours vs les 30 jours précédents (utilisateurs,
 * revenus par devise), en agrégats SQL `FILTER` par fenêtre.
 */
export const getDashboardTrends = async (): Promise<DashboardTrends> => {
  await requireRole(["admin"])

  const now = Date.now()
  const d30 = new Date(now - 30 * DAY_MS)
  const d60 = new Date(now - 60 * DAY_MS)

  const [userRow, revRows] = await Promise.all([
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

  return {
    usersTrend: round1(calculateTrend(recentUsersCount, previousUsersCount)),
    revenueByCurrency,
    recentUsersCount,
  }
}

// ============================================
// Percentile d'examen
// ============================================

/**
 * Percentiles de l'utilisateur courant, par examen : tous, ou ceux de
 * `examIds` (une page d'historique). `{}` sans session.
 */
export const getMyExamPercentiles = cache(
  async (examIds?: string[]): Promise<ExamPercentiles> => {
    const session = await getCurrentSession()
    if (!session?.user || examIds?.length === 0) return {}
    return percentilesOf(session.user.id, examIds)
  },
)

/** Percentile de l'utilisateur courant à un examen ; `null` = non disponible. */
export const getMyExamPercentile = cache(
  async (examId: string): Promise<number | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    return (await percentilesOf(session.user.id, [examId]))[examId] ?? null
  },
)

// ============================================
// Maîtrise par domaine
// ============================================

export type { DomainMastery }

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
  return domainMastery(viewerOf(session.user))
})

// ============================================
// Répartition des réponses d'une question (admin)
// ============================================

export type QuestionAnswerBreakdown = {
  answerCount: number
  /** `null` sous le seuil de signification. */
  successRate: number | null
  /** Options dans l'ordre de la question ; `share` en % des réponses comptées. */
  options: { option: string; count: number; share: number; isKey: boolean }[]
  /** Réponses dont le texte n'est plus une option de la question. */
  formerWording: { count: number; share: number }
  /** Une option actuelle autre que la clé est plus choisie que les réponses justes. */
  keySuspect: boolean
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
  if (!question)
    return {
      answerCount: 0,
      successRate: null,
      options: [],
      formerWording: { count: 0, share: 0 },
      keySuspect: false,
    }

  const stats = questionSuccessStats([questionId])
  const [counts, [summary]] = await Promise.all([
    db.execute<{ selected_answer: string; is_current: boolean; n: number }>(sql`
      select f.selected_answer, f.is_current, count(*)::int as n
        from (${firstAnswersSql([questionId])}) f
       group by f.selected_answer, f.is_current`),
    db
      .with(stats)
      .select({
        answerCount: stats.answerCount,
        successRate: stats.successRate,
        keySuspect: stats.keySuspect,
      })
      .from(stats),
  ])

  const byOption = new Map(
    counts.rows
      .filter((r) => r.is_current)
      .map((r) => [r.selected_answer, r.n]),
  )
  const formerWordingCount = counts.rows
    .filter((r) => !r.is_current)
    .reduce((total, r) => total + r.n, 0)
  const answerCount = summary?.answerCount ?? 0
  const share = (n: number) =>
    answerCount === 0 ? 0 : Math.round((100 * n) / answerCount)

  return {
    answerCount,
    successRate: summary?.successRate ?? null,
    options: question.options.map((option) => ({
      option,
      count: byOption.get(option) ?? 0,
      share: share(byOption.get(option) ?? 0),
      isKey: option === question.correctAnswer,
    })),
    formerWording: {
      count: formerWordingCount,
      share: share(formerWordingCount),
    },
    keySuspect: summary?.keySuspect ?? false,
  }
}
