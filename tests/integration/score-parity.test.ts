import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import { scoreSql } from "@/features/attempts/score"
import { computeScorePercent } from "@/lib/score"

// `lib/score.ts` affirme sa parité avec le SQL des crons ; ce test la prouve
// contre Postgres lui-même, pour tous les couples (justes, total) possibles
// d'une tentative (les examens plafonnent bien en deçà de 200 questions).
describe("AttemptScore — parité TypeScript / SQL", () => {
  it("computeScorePercent = scoreSql pour tout total ≤ 200, justes ≤ total", async () => {
    const res = await db.execute(sql`
      select total, correct, ${scoreSql(sql`correct`, sql`total`)} as score
        from generate_series(0, 200) as total,
             lateral generate_series(0, total) as correct
    `)
    const rows = res.rows as { total: number; correct: number; score: number }[]
    expect(rows).toHaveLength(20_301)

    const mismatches = rows.filter(
      (r) => computeScorePercent(r.correct, r.total) !== r.score,
    )
    expect(mismatches).toEqual([])
  })
})
