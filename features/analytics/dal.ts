import "server-only"

import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  examParticipations,
  exams,
  products,
  transactions,
  user,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"

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

// % de variation entre période courante et précédente (parité Convex).
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
