import { v } from "convex/values"
import { query } from "./_generated/server"

const TOTAL_DOMAIN_KEY = "__total__"

/**
 * Arrondit un nombre brut vers un palier marketing supérieur + suffixe "+".
 * Ex: 167 → "200+", 2875 → "3000+", 5432 → "5500+"
 */
function formatMarketingStat(n: number): string {
  if (n <= 0) return "0"
  let step: number
  if (n < 200) step = 50
  else if (n < 1000) step = 100
  else if (n < 5000) step = 500
  else step = 1000
  const rounded = Math.ceil(n / step) * step
  return `${rounded}+`
}

// Stats publiques pour les pages marketing (pas d'auth requise)
export const getMarketingStats = query({
  args: {},
  returns: v.object({
    totalQuestions: v.string(),
    totalUsers: v.string(),
    totalDomains: v.number(),
    successRate: v.string(),
    rating: v.string(),
    topDomains: v.array(v.object({ domain: v.string(), count: v.number() })),
  }),
  handler: async (ctx) => {
    // 1. Lecture depuis la table d'agrégation questionStats (~25 rows max)
    const allStats = await ctx.db.query("questionStats").take(1000)
    const totalStat = allStats.find((s) => s.domain === TOTAL_DOMAIN_KEY)
    const domainStats = allStats
      .filter((s) => s.domain !== TOTAL_DOMAIN_KEY)
      .map((s) => ({ domain: s.domain, count: s.count }))
      .sort((a, b) => b.count - a.count)

    // 2. Comptage utilisateurs (borné, acceptable à l'échelle actuelle)
    const users = await ctx.db.query("users").take(1000)

    return {
      totalQuestions: formatMarketingStat(totalStat?.count ?? 0),
      totalUsers: formatMarketingStat(users.length),
      totalDomains: domainStats.length,
      successRate: "85%",
      rating: "4.9/5",
      topDomains: domainStats.slice(0, 10),
    }
  },
})
