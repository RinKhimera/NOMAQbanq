import { createHmac, timingSafeEqual } from "node:crypto"
import "server-only"
import { env } from "@/lib/env/server"

/**
 * Jeton stateless liant le scoring du quiz marketing aux questions réellement
 * servies (#91) : la clé de réponse n'est délivrable que pour un lot signé par
 * NOUS et encore frais. Séparation de domaine dans le message signé : un HMAC
 * produit avec le même secret pour un autre usage n'est pas rejouable ici.
 */

const DOMAIN_PREFIX = "quiz-answer-key:"
const TTL_MS = 60 * 60 * 1000 // 1 h — le quiz légitime dure ~200 s
const MAX_IDS = 10 // aligné sur le clamp du tirage public

type QuizTokenPayload = { v: 1; ids: string[]; exp: number }

const hmac = (payloadB64: string) =>
  createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(DOMAIN_PREFIX + payloadB64)
    .digest()

export const signQuizToken = (questionIds: string[]): string => {
  const payload: QuizTokenPayload = {
    v: 1,
    ids: [...questionIds].sort(),
    exp: Date.now() + TTL_MS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${payloadB64}.${hmac(payloadB64).toString("base64url")}`
}

/** `null` sur TOUT échec, sans distinction de cause (pas d'oracle). */
export const verifyQuizToken = (token: string): Set<string> | null => {
  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [payloadB64, sigB64] = parts

  const expected = hmac(payloadB64)
  const provided = Buffer.from(sigB64, "base64url")
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (typeof payload !== "object" || payload === null) return null
  const p = payload as Partial<QuizTokenPayload>
  if (p.v !== 1) return null
  if (typeof p.exp !== "number" || p.exp <= Date.now()) return null
  if (
    !Array.isArray(p.ids) ||
    p.ids.length > MAX_IDS ||
    !p.ids.every((id) => typeof id === "string")
  ) {
    return null
  }
  return new Set(p.ids)
}
