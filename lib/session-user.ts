import type { getCurrentSession } from "@/lib/dal"

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>

/**
 * Sous-ensemble de la session destiné au client. La session Better Auth porte
 * `session.token` : elle ne doit JAMAIS traverser la frontière serveur-client
 * (`.claude/rules/data-layer.md`). On projette explicitement, on ne « nettoie »
 * pas — un champ ajouté à Better Auth ne doit pas fuiter par défaut.
 */
export type SessionUser = {
  name: string
  email: string
  image: string | null
  role: "user" | "admin"
}

export const toSessionUser = (session: Session): SessionUser => ({
  name: session.user.name,
  email: session.user.email,
  image: session.user.image ?? null,
  role: (session.user.role ?? "user") as "user" | "admin",
})
