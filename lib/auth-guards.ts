import { redirect } from "next/navigation"
import "server-only"
import { getCurrentSession } from "@/lib/dal"

/** Page/Server Action : redirige vers la connexion si pas de session. */
export async function requireSession() {
  const session = await getCurrentSession()
  if (!session) redirect("/connexion")
  return session
}

/** Page/Server Action : exige un des rôles ; sinon redirige vers l'accueil membre. */
export async function requireRole(roles: Array<"user" | "admin">) {
  const session = await requireSession()
  const role = (session.user.role ?? "user") as "user" | "admin"
  if (!roles.includes(role)) redirect("/dashboard")
  return session
}

/** Route handler : renvoie la session ou null (ne redirige PAS — pour répondre 401/403). */
export async function getSessionForRoute() {
  return getCurrentSession()
}
