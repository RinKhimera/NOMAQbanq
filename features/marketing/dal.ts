import { isNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import { questions, user } from "@/db/schema"

export type MarketingStats = {
  totalQuestions: string
  totalUsers: string
  totalDomains: number
  successRate: string
  rating: string
  topDomains: { domain: string; count: number }[]
}

// Arrondit un nombre brut vers un palier marketing supérieur + suffixe "+".
// Ex: 167 → "200+", 2875 → "3000+". Parité avec `convex/marketing.ts`.
const formatMarketingStat = (n: number): string => {
  if (n <= 0) return "0"
  let step: number
  if (n < 200) step = 50
  else if (n < 1000) step = 100
  else if (n < 5000) step = 500
  else step = 1000
  return `${Math.ceil(n / step) * step}+`
}

/**
 * Stats publiques pour les pages marketing (aucune auth requise). Comptes SQL
 * live par domaine (remplace la table d'agrégat `questionStats` droppée).
 * Remplace `marketing.getMarketingStats`.
 */
export const getMarketingStats = cache(async (): Promise<MarketingStats> => {
  const domainRows = await db
    .select({
      domain: questions.domain,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(questions)
    .where(isNull(questions.deletedAt))
    .groupBy(questions.domain)
    .orderBy(sql`count(*) desc`)

  const totalQuestions = domainRows.reduce((sum, r) => sum + r.count, 0)

  const [users] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(user)

  return {
    totalQuestions: formatMarketingStat(totalQuestions),
    totalUsers: formatMarketingStat(users?.n ?? 0),
    totalDomains: domainRows.length,
    successRate: "85%",
    rating: "4.9/5",
    topDomains: domainRows.slice(0, 10).map((r) => ({
      domain: r.domain,
      count: r.count,
    })),
  }
})
