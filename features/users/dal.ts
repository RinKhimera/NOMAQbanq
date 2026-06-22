import "server-only"

import { and, asc, eq, isNull, ne } from "drizzle-orm"
import { cache } from "react"

import { db } from "@/db"
import { user } from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"

// Lecture fraîche de l'utilisateur courant depuis Neon (pas la session cachée) :
// l'édition de profil reste à jour immédiatement après revalidation. Sélectionne
// UNIQUEMENT les colonnes utilisées par l'UI profil (pas de fat document).
export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession()
  if (!session?.user) return null

  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      username: user.username,
      bio: user.bio,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.id, session.user.id), isNull(user.deletedAt)))
    .limit(1)

  return row ?? null
})

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export type SelectableUser = { id: string; name: string; email: string }

/**
 * [Admin] Liste des utilisateurs non-admin sélectionnables (combobox du paiement
 * manuel). Remplace `getAllUsers` Convex. Colonnes minimales, exclut les admins
 * et les comptes supprimés, triés par nom. Borné à 500 (parité Convex `.take(500)`)
 * — au-delà, prévoir une recherche serveur paginée.
 */
export const getSelectableUsers = cache(
  async (): Promise<SelectableUser[]> => {
    await requireRole(["admin"])

    return db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(and(ne(user.role, "admin"), isNull(user.deletedAt)))
      .orderBy(asc(user.name))
      .limit(500)
  },
)
