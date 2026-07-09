import { and, eq, lt } from "drizzle-orm"
import { headers } from "next/headers"
import { createHmac } from "node:crypto"
import "server-only"
import { db } from "@/db"
import { quizRateLimits } from "@/db/schema"
import { env } from "@/lib/env/server"

const WINDOW_MS = 60 * 60 * 1000 // 1 h
const MAX_PER_WINDOW = 30 // légitime = 1 appel/action/tentative ; marge NAT
const RETENTION_MS = 24 * 60 * 60 * 1000

export type QuizRateLimitAction = "load" | "score"

/**
 * Clé pseudonyme de l'appelant anonyme : HMAC de l'IP (`x-forwarded-for` posé
 * par Vercel, premier élément = client). Le HMAC (et non un simple hash) déjoue
 * le brute-force de l'espace IPv4 — aucune IP en clair en base. Sans header
 * (hors proxy) : bucket partagé "unknown", fail-closed assumé.
 */
export const getClientIpKey = async (): Promise<string> => {
  const h = await headers()
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`quiz-ip:${ip}`)
    .digest("hex")
    .slice(0, 32)
}

/** Consomme un slot pour `(key, action)`. `false` = limite atteinte (refus silencieux côté action). */
export const consumeQuizRateLimit = async (
  key: string,
  action: QuizRateLimitAction,
): Promise<boolean> => {
  const now = Date.now()

  return db.transaction(async (tx) => {
    // Garantit la ligne sans toucher aux compteurs existants (course à la
    // première insertion), puis verrou de ligne : les requêtes concurrentes de
    // la même clé sont sérialisées.
    await tx
      .insert(quizRateLimits)
      .values({ key, action, count: 0, windowStart: new Date(now) })
      .onConflictDoNothing({
        target: [quizRateLimits.key, quizRateLimits.action],
      })

    const [row] = await tx
      .select({
        id: quizRateLimits.id,
        count: quizRateLimits.count,
        windowStart: quizRateLimits.windowStart,
      })
      .from(quizRateLimits)
      .where(
        and(eq(quizRateLimits.key, key), eq(quizRateLimits.action, action)),
      )
      .for("update")
      .limit(1)
    if (!row) return true // garde défensive : la ligne existe forcément

    const windowAge = now - row.windowStart.getTime()
    if (windowAge >= WINDOW_MS) {
      await tx
        .update(quizRateLimits)
        .set({ count: 1, windowStart: new Date(now) })
        .where(eq(quizRateLimits.id, row.id))
      return true
    }
    if (row.count < MAX_PER_WINDOW) {
      await tx
        .update(quizRateLimits)
        .set({ count: row.count + 1 })
        .where(eq(quizRateLimits.id, row.id))
      return true
    }
    return false
  })
}

/** Purge des fenêtres mortes (> 24 h) — la table ne croît pas sans borne. */
export const cleanupQuizRateLimits = async (): Promise<{
  deletedCount: number
}> => {
  const res = await db
    .delete(quizRateLimits)
    .where(lt(quizRateLimits.windowStart, new Date(Date.now() - RETENTION_MS)))
    .returning({ id: quizRateLimits.id })
  return { deletedCount: res.length }
}
