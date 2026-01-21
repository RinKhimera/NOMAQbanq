import { query } from "./_generated/server"
import { getAdminUserOrThrow } from "./lib/auth"
import { batchGetByIds } from "./lib/batchFetch"

// ============================================
// ADMIN DASHBOARD ANALYTICS
// ============================================
//
// NOTE OPTIMISATION: Ces queries utilisent Date.now() et .filter() JS.
// Compromis acceptés car:
// - Dashboard admin rechargé manuellement (pas de besoin temps réel)
// - .filter() JS toujours précédé de .take(n) (volume contrôlé)
// Si >10k docs, envisager index composés ou table d'agrégation.
// ============================================

/**
 * Récupère les 10 dernières activités (inscriptions, paiements, examens complétés)
 * pour le fil d'activité du dashboard admin
 */
export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    // Récupérer les données récentes de chaque source
    const [recentUsers, recentTransactions, recentExamParticipations] =
      await Promise.all([
        ctx.db.query("users").order("desc").take(5),
        ctx.db
          .query("transactions")
          .withIndex("by_status", (q) => q.eq("status", "completed"))
          .order("desc")
          .take(5),
        ctx.db
          .query("examParticipations")
          .withIndex("by_status", (q) => q.eq("status", "completed"))
          .order("desc")
          .take(5),
      ])

    // Batch fetch related data
    const userIds = [
      ...recentTransactions.map((t) => t.userId),
      ...recentExamParticipations.map((p) => p.userId),
    ]
    const examIds = recentExamParticipations.map((p) => p.examId)
    const productIds = recentTransactions.map((t) => t.productId)

    const [userMap, examMap, productMap] = await Promise.all([
      batchGetByIds(ctx, "users", userIds),
      batchGetByIds(ctx, "exams", examIds),
      batchGetByIds(ctx, "products", productIds),
    ])

    // Construire les activités avec leur type
    type Activity =
      | {
          type: "user_signup"
          timestamp: number
          data: {
            userName: string
            userEmail: string | undefined
          }
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
          data: {
            userName: string
            examTitle: string
            score: number | null
          }
        }

    const activities: Activity[] = []

    // Ajout des inscriptions
    for (const user of recentUsers) {
      activities.push({
        type: "user_signup",
        timestamp: user._creationTime,
        data: {
          userName: user.name ?? "Utilisateur",
          userEmail: user.email,
        },
      })
    }

    // Ajout des paiements
    for (const tx of recentTransactions) {
      const user = userMap.get(tx.userId)
      const product = productMap.get(tx.productId)
      if (tx.completedAt) {
        activities.push({
          type: "payment",
          timestamp: tx.completedAt,
          data: {
            userName: user?.name ?? "Utilisateur",
            amount: tx.amountPaid,
            currency: tx.currency,
            productName: product?.name ?? "Produit",
            paymentType: tx.type,
          },
        })
      }
    }

    // Ajout des examens complétés
    for (const participation of recentExamParticipations) {
      const user = userMap.get(participation.userId)
      const exam = examMap.get(participation.examId)
      if (participation.completedAt) {
        activities.push({
          type: "exam_completed",
          timestamp: participation.completedAt,
          data: {
            userName: user?.name ?? "Utilisateur",
            examTitle: exam?.title ?? "Examen",
            score: participation.score,
          },
        })
      }
    }

    // Trier par timestamp décroissant et limiter à 10
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
  },
})

/**
 * Calcule les tendances sur 30 jours pour le dashboard admin
 * Compare les 30 derniers jours avec les 30 jours précédents
 */
export const getDashboardTrends = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000

    // Récupérer les données nécessaires
    const [users, completedTransactions, examParticipations] =
      await Promise.all([
        ctx.db.query("users").take(2000),
        ctx.db
          .query("transactions")
          .withIndex("by_status", (q) => q.eq("status", "completed"))
          .take(2000),
        ctx.db
          .query("examParticipations")
          .withIndex("by_status", (q) => q.eq("status", "completed"))
          .take(2000),
      ])

    // Calcul des tendances utilisateurs
    const recentUsers = users.filter((u) => u._creationTime > thirtyDaysAgo)
    const previousUsers = users.filter(
      (u) => u._creationTime > sixtyDaysAgo && u._creationTime <= thirtyDaysAgo,
    )
    const usersTrend = calculateTrend(recentUsers.length, previousUsers.length)

    // Calcul des tendances revenus
    const recentRevenue = completedTransactions
      .filter((tx) => tx.completedAt && tx.completedAt > thirtyDaysAgo)
      .reduce((sum, tx) => sum + tx.amountPaid, 0)
    const previousRevenue = completedTransactions
      .filter(
        (tx) =>
          tx.completedAt &&
          tx.completedAt > sixtyDaysAgo &&
          tx.completedAt <= thirtyDaysAgo,
      )
      .reduce((sum, tx) => sum + tx.amountPaid, 0)
    const revenueTrend = calculateTrend(recentRevenue, previousRevenue)

    // Calcul des tendances participations
    const recentParticipations = examParticipations.filter(
      (p) => p.completedAt && p.completedAt > thirtyDaysAgo,
    )
    const previousParticipations = examParticipations.filter(
      (p) =>
        p.completedAt &&
        p.completedAt > sixtyDaysAgo &&
        p.completedAt <= thirtyDaysAgo,
    )
    const participationsTrend = calculateTrend(
      recentParticipations.length,
      previousParticipations.length,
    )

    return {
      usersTrend: Math.round(usersTrend * 10) / 10,
      revenueTrend: Math.round(revenueTrend * 10) / 10,
      participationsTrend: Math.round(participationsTrend * 10) / 10,
      // Données brutes pour référence
      recentUsersCount: recentUsers.length,
      recentRevenue,
      recentParticipationsCount: recentParticipations.length,
    }
  },
})

/**
 * Récupère le nombre de paiements échoués récents
 */
export const getFailedPaymentsCount = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    const failedTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(100)

    const recentFailed = failedTransactions.filter(
      (tx) => tx.createdAt > sevenDaysAgo,
    )

    return recentFailed.length
  },
})

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcule le pourcentage de changement entre deux périodes
 */
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - previous) / previous) * 100
}
