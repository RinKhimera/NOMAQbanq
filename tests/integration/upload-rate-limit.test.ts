import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { db } from "@/db"
import { uploadRateLimits, user } from "@/db/schema"
import { createId } from "@/lib/ids"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"

const userId = createId()

const countFor = async (uploadType: "avatar" | "question-image") => {
  const [row] = await db
    .select({ count: uploadRateLimits.count })
    .from(uploadRateLimits)
    .where(
      and(
        eq(uploadRateLimits.userId, userId),
        eq(uploadRateLimits.uploadType, uploadType),
      ),
    )
    .limit(1)
  return row?.count
}

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "RL Test",
    email: `rl-${userId}@test.invalid`,
  })
})

afterAll(async () => {
  await db.delete(uploadRateLimits).where(eq(uploadRateLimits.userId, userId))
  await db.delete(user).where(eq(user.id, userId))
})

// Tests séquentiels : ils partagent le compteur "avatar" du même utilisateur.
describe("consumeUploadRateLimit", () => {
  it("autorise jusqu'à la limite avatar (5/h) puis bloque sans consommer", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await consumeUploadRateLimit(userId, "avatar")).allowed).toBe(true)
    }
    expect(await countFor("avatar")).toBe(5)

    const blocked = await consumeUploadRateLimit(userId, "avatar")
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) {
      expect(blocked.retryAfterMinutes).toBeGreaterThan(0)
      expect(blocked.retryAfterMinutes).toBeLessThanOrEqual(60)
    }
    // Refus → pas de consommation supplémentaire.
    expect(await countFor("avatar")).toBe(5)
  })

  it("compte chaque type d'upload indépendamment", async () => {
    const r = await consumeUploadRateLimit(userId, "question-image")
    expect(r.allowed).toBe(true)
    expect(await countFor("question-image")).toBe(1)
    // L'avatar reste à 5 (non affecté).
    expect(await countFor("avatar")).toBe(5)
  })

  it("réinitialise le compteur quand la fenêtre est expirée", async () => {
    await db
      .update(uploadRateLimits)
      .set({ windowStart: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where(
        and(
          eq(uploadRateLimits.userId, userId),
          eq(uploadRateLimits.uploadType, "avatar"),
        ),
      )

    const r = await consumeUploadRateLimit(userId, "avatar")
    expect(r.allowed).toBe(true)
    expect(await countFor("avatar")).toBe(1) // fenêtre repartie à 1
  })
})
