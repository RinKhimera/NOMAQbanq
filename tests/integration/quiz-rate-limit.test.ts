import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { quizRateLimits } from "@/db/schema"
import { createId } from "@/lib/ids"
import {
  cleanupQuizRateLimits,
  consumeQuizRateLimit,
  getClientIpKey,
} from "@/lib/quiz-rate-limit"

vi.mock("next/headers", () => ({ headers: vi.fn() }))

const mockHeaders = (h: Record<string, string>) =>
  vi.mocked(headers).mockResolvedValue(new Headers(h) as never)

const HOUR = 60 * 60 * 1000

const seedCounter = (
  key: string,
  action: "load" | "score",
  count: number,
  windowStart = new Date(),
) => db.insert(quizRateLimits).values({ key, action, count, windowStart })

const counterOf = async (key: string) =>
  db
    .select({ action: quizRateLimits.action, count: quizRateLimits.count })
    .from(quizRateLimits)
    .where(eq(quizRateLimits.key, key))

describe("consumeQuizRateLimit", () => {
  it("autorise 30 appels/h puis refuse le 31e ; une autre clé n'est pas affectée", async () => {
    const key = createId()
    const other = createId()
    for (let i = 0; i < 30; i++) {
      expect(await consumeQuizRateLimit(key, "load")).toBe(true)
    }
    expect(await consumeQuizRateLimit(key, "load")).toBe(false)
    expect(await consumeQuizRateLimit(other, "load")).toBe(true)
    expect(await counterOf(key)).toEqual([{ action: "load", count: 30 }])
  })

  it("compte load et score indépendamment", async () => {
    const key = createId()
    await seedCounter(key, "load", 30)
    expect(await consumeQuizRateLimit(key, "score")).toBe(true)
    expect(await consumeQuizRateLimit(key, "load")).toBe(false)
  })

  it("réinitialise le compteur quand la fenêtre expire", async () => {
    const key = createId()
    await seedCounter(key, "load", 30, new Date(Date.now() - HOUR - 60_000))
    expect(await consumeQuizRateLimit(key, "load")).toBe(true)
    expect(await counterOf(key)).toEqual([{ action: "load", count: 1 }])
  })
})

describe("getClientIpKey", () => {
  it("dérive la clé du premier élément de x-forwarded-for", async () => {
    mockHeaders({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })
    const fromXff = await getClientIpKey()
    // Même IP via x-forwarded-for direct → même clé (1er élément retenu).
    mockHeaders({ "x-forwarded-for": "9.9.9.9" })
    expect(await getClientIpKey()).toBe(fromXff)
  })

  it("retombe sur x-real-ip quand x-forwarded-for est absent (même clé pour la même IP)", async () => {
    mockHeaders({ "x-forwarded-for": "9.9.9.9" })
    const fromXff = await getClientIpKey()
    mockHeaders({ "x-real-ip": "9.9.9.9" })
    expect(await getClientIpKey()).toBe(fromXff)
  })

  it("retombe sur le bucket « unknown » sans aucun en-tête d'IP", async () => {
    mockHeaders({})
    const unknown = await getClientIpKey()
    mockHeaders({ "x-forwarded-for": "9.9.9.9" })
    expect(await getClientIpKey()).not.toBe(unknown)
    // Clé stable : jamais l'IP en clair, longueur bornée (HMAC tronqué).
    expect(unknown).toHaveLength(32)
  })
})

describe("cleanupQuizRateLimits", () => {
  it("purge les fenêtres de plus de 24 h, conserve les récentes", async () => {
    const stale = createId()
    const recent = createId()
    await seedCounter(stale, "load", 3, new Date(Date.now() - 25 * HOUR))
    await seedCounter(recent, "load", 3, new Date(Date.now() - 23 * HOUR))

    expect(await cleanupQuizRateLimits()).toEqual({ deletedCount: 1 })
    expect(await counterOf(stale)).toEqual([])
    expect(await counterOf(recent)).toEqual([{ action: "load", count: 3 }])
  })
})
