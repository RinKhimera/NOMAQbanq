import "server-only"

import { and, eq, isNull } from "drizzle-orm"
import { cache } from "react"

import { db } from "@/db"
import { user } from "@/db/schema"
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
