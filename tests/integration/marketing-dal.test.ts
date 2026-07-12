import { eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { examParticipations, exams, user } from "@/db/schema"
import { getMarketingStats } from "@/features/marketing/dal"
import {
  MIN_COMPLETED_PARTICIPATIONS,
  SUCCESS_SCORE_THRESHOLD,
  resolveSuccessRate,
} from "@/features/marketing/lib"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const examId = createId()
const creatorId = createId()
// Assez de participations pour franchir le seuil de volume à coup sûr.
const N = MIN_COMPLETED_PARTICIPATIONS + 10
const userIds = Array.from({ length: N }, () => createId())

const baselineAgg = async () => {
  const [row] = await db
    .select({
      completed:
        sql<number>`count(*) filter (where status in ('completed','auto_submitted'))`.mapWith(
          Number,
        ),
      passed:
        sql<number>`count(*) filter (where status in ('completed','auto_submitted') and score >= ${SUCCESS_SCORE_THRESHOLD})`.mapWith(
          Number,
        ),
    })
    .from(examParticipations)
  return row ?? { completed: 0, passed: 0 }
}

beforeAll(async () => {
  await db.insert(user).values({
    id: creatorId,
    name: "Créateur Marketing",
    email: `mktg-${suffix}@test.invalid`,
    emailVerified: true,
  })
  await db.insert(exams).values({
    id: examId,
    title: `Examen marketing ${suffix}`,
    startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
    endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    completionTime: 3600,
    createdBy: creatorId,
  })
  await db.insert(user).values(
    userIds.map((id, i) => ({
      id,
      name: `Participant ${i}`,
      email: `mktg-p-${i}-${suffix}@test.invalid`,
      emailVerified: true,
    })),
  )
  await db.insert(examParticipations).values(
    userIds.map((uid) => ({
      examId,
      userId: uid,
      status: "completed" as const,
      score: 90, // ≥ SUCCESS_SCORE_THRESHOLD → réussite
      completedAt: new Date(),
    })),
  )
})

afterAll(async () => {
  await db.delete(exams).where(eq(exams.id, examId)) // cascade participations
  await db.delete(user).where(inArray(user.id, [creatorId, ...userIds]))
})

describe("getMarketingStats — successRate calculé", () => {
  it("ne renvoie plus le champ rating", async () => {
    const stats = await getMarketingStats()
    expect(stats).not.toHaveProperty("rating")
  })

  it("câble l'agrégat SQL sur resolveSuccessRate (oracle exact, baseline develop quelconque)", async () => {
    // La branche de test est clonée de develop (scripts/neon-api.ts), donc la
    // baseline n'est JAMAIS vide : l'oracle recalcule l'agrégat réel et exige
    // l'égalité avec la bascule — exact quelle que soit la baseline (revue design
    // 2026-07-12, #1 : l'ancien if/else était tautologique dans sa branche else).
    const agg = await baselineAgg()
    const stats = await getMarketingStats()
    expect(stats.successRate).toBe(resolveSuccessRate(agg))
    // Nos N insertions garantissent le franchissement du seuil de volume.
    expect(agg.completed).toBeGreaterThanOrEqual(MIN_COMPLETED_PARTICIPATIONS)
  })
})
