import { headers } from "next/headers"
import { cache } from "react"
import "server-only"
import { auth } from "@/lib/auth"

// Dédupliqué par render via React cache(). Un compte suspendu (`user.banned`,
// relu en base à chaque requête : pas de cookieCache) est traité comme
// déconnecté par TOUS les consommateurs — la suspension supprime les sessions,
// ceci couvre la requête en vol au moment du ban.
export const getCurrentSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.banned) return null
  return session
})
