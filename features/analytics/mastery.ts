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

/** Questions comptées et justes, par domaine pratiqué. */
export type MasteryCounts = Map<string, { answered: number; correct: number }>

/**
 * Comptes bruts de la maîtrise de `viewer`, par domaine. `before` : tels
 * qu'ils étaient à cet instant, sur les seules réponses d'avant (tendance de
 * maîtrise). Ne garde rien : l'appelant est une lecture gardée.
 */
export const masteryCounts = async (
  viewer: LockUser,
  before?: Date,
): Promise<MasteryCounts> => {
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
  return new Map(
    result.rows.map(({ domain, ...counts }) => [domain, counts] as const),
  )
}

/** Les 22 domaines dans l'ordre de `MEDICAL_DOMAINS`, avec leur maîtrise. */
export const toDomainMastery = (counts: MasteryCounts): DomainMastery[] =>
  MEDICAL_DOMAINS.map((domain) => {
    const row = counts.get(domain)
    return {
      domain,
      answered: row?.answered ?? 0,
      mastery: row ? masteryPercent(row.correct, row.answered) : null,
    }
  })

/** Maîtrise par domaine de `viewer`. */
export const domainMastery = async (
  viewer: LockUser,
): Promise<DomainMastery[]> => toDomainMastery(await masteryCounts(viewer))
