import { isNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import { examParticipations, questions, user } from "@/db/schema"
import { PASS_THRESHOLD } from "@/lib/score"
import { resolveSuccessRate } from "./lib"

export type MarketingStats = {
  totalQuestions: string
  totalUsers: string
  successRate: string
}

// Arrondit un nombre brut vers un palier marketing supérieur + suffixe "+".
// Ex: 167 → "200+", 2875 → "3000+".
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
 * Stats publiques pour les pages marketing (aucune auth requise). Aucun compte
 * par domaine : la vitrine ne publie pas le nombre de questions d'un domaine.
 */
export const getMarketingStats = cache(async (): Promise<MarketingStats> => {
  const [bank] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(questions)
    .where(isNull(questions.deletedAt))

  const [users] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(user)
    // Exclut les comptes supprimés (cohérent avec questions + getAdminStats).
    .where(isNull(user.deletedAt))

  // Taux de réussite réel sur les participations terminées. Pas de jointure
  // user : les participations de comptes soft-deleted COMPTENT (un passage
  // d'examen réel reste un point de donnée du taux — on mesure des passages, pas
  // des comptes actifs).
  const [participationAgg] = await db
    .select({
      completed:
        sql<number>`count(*) filter (where ${examParticipations.status} in ('completed','auto_submitted'))`.mapWith(
          Number,
        ),
      passed:
        sql<number>`count(*) filter (where ${examParticipations.status} in ('completed','auto_submitted') and ${examParticipations.score} >= ${PASS_THRESHOLD})`.mapWith(
          Number,
        ),
    })
    .from(examParticipations)

  return {
    totalQuestions: formatMarketingStat(bank?.n ?? 0),
    totalUsers: formatMarketingStat(users?.n ?? 0),
    successRate: resolveSuccessRate({
      completed: participationAgg?.completed ?? 0,
      passed: participationAgg?.passed ?? 0,
    }),
  }
})
