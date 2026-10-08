import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import { scoreSql } from "@/features/attempts/score"
import { MAX_EXAM_QUESTIONS } from "@/features/exams/schemas"
import { computeScorePercent } from "@/lib/score"

// `lib/score.ts` affirme sa parité avec le SQL des crons ; ce test la prouve
// contre Postgres lui-même, pour tous les couples (justes, total) possibles
// d'une tentative : un examen blanc plafonne à `MAX_EXAM_QUESTIONS`, une
// session d'entraînement bien en deçà.
describe("AttemptScore — parité TypeScript / SQL", () => {
  it("computeScorePercent = scoreSql pour tout total ≤ MAX_EXAM_QUESTIONS, justes ≤ total", async () => {
    const res = await db.execute(sql`
      select total, correct, ${scoreSql(sql`correct`, sql`total`)} as score
        from generate_series(0, ${MAX_EXAM_QUESTIONS}::int) as total,
             lateral generate_series(0, total) as correct
    `)
    const rows = res.rows as { total: number; correct: number; score: number }[]
    // Σ (total + 1) pour total de 0 à N.
    const n = MAX_EXAM_QUESTIONS
    expect(rows).toHaveLength(((n + 1) * (n + 2)) / 2)

    const mismatches = rows.filter(
      (r) => computeScorePercent(r.correct, r.total) !== r.score,
    )
    expect(mismatches).toEqual([])
  })
})
