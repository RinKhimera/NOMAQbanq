import { createHmac, timingSafeEqual } from "node:crypto"
import "server-only"
import { env } from "@/lib/env/server"

// Séparation de domaine : un HMAC produit avec le même secret pour un autre
// usage (jeton de quiz) n'est pas rejouable ici. Pas d'expiration : le lien
// d'un vieux courriel doit rester valide (la LCAP exige 60 jours minimum) et
// la révocation est idempotente.
const DOMAIN_PREFIX = "unsubscribe:"

const sign = (userIdB64: string) =>
  createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(DOMAIN_PREFIX + userIdB64)
    .digest()

export const createUnsubscribeToken = (userId: string): string => {
  const userIdB64 = Buffer.from(userId, "utf8").toString("base64url")
  return `${userIdB64}.${sign(userIdB64).toString("base64url")}`
}

/** `null` sur TOUT échec, sans distinction de cause (pas d'oracle). */
export const verifyUnsubscribeToken = (
  token: string | null | undefined,
): string | null => {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [userIdB64, sigB64] = parts
  const expected = sign(userIdB64)
  const provided = Buffer.from(sigB64, "base64url")
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null
  }
  const userId = Buffer.from(userIdB64, "base64url").toString("utf8")
  return userId.length > 0 ? userId : null
}

export const createUnsubscribeUrl = (baseUrl: string, userId: string): string =>
  `${baseUrl}/desabonnement?token=${encodeURIComponent(createUnsubscribeToken(userId))}`
