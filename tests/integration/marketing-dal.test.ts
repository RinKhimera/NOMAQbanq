import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { examParticipations, exams, user } from "@/db/schema"
import { getMarketingStats } from "@/features/marketing/dal"
import {
  MIN_COMPLETED_PARTICIPATIONS,
  resolveSuccessRate,
} from "@/features/marketing/lib"
import { createId } from "@/lib/ids"
import { PASS_THRESHOLD } from "@/lib/score"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const examId = createId()
const creatorId = createId()
// Assez de participations pour franchir le seuil de volume à coup sûr, dont
// une part sous le seuil de réussite : sans elle, retirer le filtre sur le
// score donnerait le même taux.
const PASSED = MIN_COMPLETED_PARTICIPATIONS + 10
const FAILED = 10
const userIds = Array.from({ length: PASSED + FAILED }, () => createId())

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
    targetQuestionCount: 10,
    finalizedAt: new Date(),
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
    userIds.map((uid, i) => ({
      examId,
      userId: uid,
      status: "completed" as const,
      score: i < PASSED ? PASS_THRESHOLD + 30 : PASS_THRESHOLD - 1,
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

  it("ne publie aucun nombre de questions par domaine", async () => {
    const stats = await getMarketingStats()
    expect(Object.keys(stats).toSorted()).toEqual([
      "successRate",
      "totalQuestions",
      "totalUsers",
    ])
  })

  it("publie le taux des seules participations au-dessus du seuil", async () => {
    const stats = await getMarketingStats()
    const expected = resolveSuccessRate({
      completed: PASSED + FAILED,
      passed: PASSED,
    })
    expect(stats.successRate).toBe(expected)
    expect(expected).not.toBe(
      resolveSuccessRate({
        completed: PASSED + FAILED,
        passed: PASSED + FAILED,
      }),
    )
  })

  it("arrondit le nombre d'inscrits au palier marketing", async () => {
    // Le créateur + 70 participants.
    expect((await getMarketingStats()).totalUsers).toBe("100+")
  })
})
