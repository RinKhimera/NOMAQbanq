import { and, eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import { uploadRateLimits, user } from "@/db/schema"
import { createId } from "@/lib/ids"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"

const HOUR = 60 * 60 * 1000

const newUser = async () => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: "RL Test", email: `rl-${id}@test.invalid` })
  return id
}

/** Compteur avatar déjà au plafond (5/h), fenêtre ouverte à `windowStart`. */
const seedFullAvatarWindow = (userId: string, windowStart: Date) =>
  db
    .insert(uploadRateLimits)
    .values({ userId, uploadType: "avatar", count: 5, windowStart })

const countFor = async (
  userId: string,
  uploadType: "avatar" | "question-image",
) => {
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

describe("consumeUploadRateLimit", () => {
  it("autorise jusqu'à la limite avatar (5/h) puis bloque sans consommer", async () => {
    const userId = await newUser()
    for (let i = 0; i < 5; i++) {
      expect((await consumeUploadRateLimit(userId, "avatar")).allowed).toBe(
        true,
      )
    }
    expect(await countFor(userId, "avatar")).toBe(5)

    const blocked = await consumeUploadRateLimit(userId, "avatar")
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed) throw new Error("rate-limit non declenche")
    expect(blocked.retryAfterMinutes).toBeGreaterThan(0)
    expect(blocked.retryAfterMinutes).toBeLessThanOrEqual(60)
    // Refus → pas de consommation supplémentaire.
    expect(await countFor(userId, "avatar")).toBe(5)
  })

  it("compte chaque type d'upload indépendamment", async () => {
    const userId = await newUser()
    await seedFullAvatarWindow(userId, new Date())

    const r = await consumeUploadRateLimit(userId, "question-image")
    expect(r.allowed).toBe(true)
    expect(await countFor(userId, "question-image")).toBe(1)
    expect(await countFor(userId, "avatar")).toBe(5)
  })

  it("réinitialise le compteur quand la fenêtre est expirée", async () => {
    const userId = await newUser()
    await seedFullAvatarWindow(userId, new Date(Date.now() - 2 * HOUR))

    const r = await consumeUploadRateLimit(userId, "avatar")
    expect(r.allowed).toBe(true)
    expect(await countFor(userId, "avatar")).toBe(1) // fenêtre repartie à 1
  })
})
