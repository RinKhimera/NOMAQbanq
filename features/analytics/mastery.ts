import { sql } from "drizzle-orm"
import "server-only"
import { MEDICAL_DOMAINS } from "@/constants"
import { db } from "@/db"
import type { LockUser } from "../questions/answer-key-lock"
import { latestAnswersSql, masteryPercent } from "./answers-sql"

export type DomainMastery = {
  domain: string
  /** Questions comptées : la dernière réponse de l'étudiant à chacune. */
  answered: number
  /** Part de justes, en % ; `null` = domaine jamais pratiqué, jamais 0. */
  mastery: number | null
}

/**
 * Maîtrise par domaine de `viewer`, les 22 domaines dans l'ordre de
 * `MEDICAL_DOMAINS`. `before` : la maîtrise telle qu'elle était à cet instant,
 * sur les seules réponses datées d'avant (tendance de maîtrise). Ne garde
 * rien : l'appelant est une lecture gardée.
 */
export const domainMastery = async (
  viewer: LockUser,
  before?: Date,
): Promise<DomainMastery[]> => {
  const result = await db.execute<{
    domain: string
    answered: number
    correct: number
  }>(sql`
      select l.domain,
             count(*)::int as answered,
             (count(*) filter (where l.is_correct))::int as correct
        from (${latestAnswersSql(viewer, before)}) l
       group by l.domain`)

  const byDomain = new Map(result.rows.map((r) => [r.domain, r]))
  return MEDICAL_DOMAINS.map((domain) => {
    const row = byDomain.get(domain)
    return {
      domain,
      answered: row?.answered ?? 0,
      mastery: row ? masteryPercent(row.correct, row.answered) : null,
    }
  })
}
