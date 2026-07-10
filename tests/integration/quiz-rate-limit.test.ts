import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { afterAll, describe, expect, it, vi } from "vitest"
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

const keyA = `test-key-${createId()}`
const keyB = `test-key-${createId()}`

afterAll(async () => {
  for (const key of [keyA, keyB]) {
    await db.delete(quizRateLimits).where(eq(quizRateLimits.key, key))
  }
})

describe("consumeQuizRateLimit", () => {
  it("autorise 30 appels/h puis refuse le 31e ; une autre clé n'est pas affectée", async () => {
    for (let i = 0; i < 30; i++) {
      expect(await consumeQuizRateLimit(keyA, "load")).toBe(true)
    }
    expect(await consumeQuizRateLimit(keyA, "load")).toBe(false)
    expect(await consumeQuizRateLimit(keyB, "load")).toBe(true)
  })

  it("compte load et score indépendamment", async () => {
    // keyA est épuisée en "load" (test précédent) mais vierge en "score".
    expect(await consumeQuizRateLimit(keyA, "score")).toBe(true)
  })

  it("réinitialise le compteur quand la fenêtre expire", async () => {
    await db
      .update(quizRateLimits)
      .set({ windowStart: new Date(Date.now() - 61 * 60 * 1000) })
      .where(eq(quizRateLimits.key, keyA))
    expect(await consumeQuizRateLimit(keyA, "load")).toBe(true)
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
    await db
      .update(quizRateLimits)
      .set({ windowStart: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(quizRateLimits.key, keyB))
    await cleanupQuizRateLimits()

    const gone = await db
      .select({ id: quizRateLimits.id })
      .from(quizRateLimits)
      .where(eq(quizRateLimits.key, keyB))
    expect(gone).toHaveLength(0)

    const kept = await db
      .select({ id: quizRateLimits.id })
      .from(quizRateLimits)
      .where(eq(quizRateLimits.key, keyA))
    expect(kept.length).toBeGreaterThan(0)
  })
})
