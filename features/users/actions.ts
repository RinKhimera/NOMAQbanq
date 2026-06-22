"use server"

import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { user } from "@/db/schema"
import {
  getUserPanelData,
  getUsersWithFilters,
  type AdminUsersPage,
  type UserPanelData,
  type UsersFilters,
} from "@/features/users/dal"
import { profileSchema } from "@/features/users/schemas"
import { requireRole, requireSession } from "@/lib/auth-guards"

export type UpdateProfileResult = { success: boolean; error?: string }

/**
 * [Admin] Charge une page de la liste filtrée (changement de filtre/tri/recherche
 * et « charger plus » côté client). Garde admin redoublée (la DAL garde aussi).
 */
export const loadUsersPage = async (
  filters: UsersFilters,
): Promise<AdminUsersPage> => {
  await requireRole(["admin"])
  return getUsersWithFilters(filters)
}

/**
 * [Admin] Données du panneau latéral d'un utilisateur (chargées à l'ouverture).
 * `null` si introuvable.
 */
export const loadUserPanelData = async (
  userId: string,
): Promise<UserPanelData | null> => {
  await requireRole(["admin"])
  return getUserPanelData(userId)
}

// Appelée directement depuis le client (édition inline + onboarding) :
// authz → zod → unicité username → update → revalidation.
export const updateProfile = async (input: {
  name: string
  username: string
  bio?: string
}): Promise<UpdateProfileResult> => {
  const session = await requireSession()

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }

  const name = parsed.data.name
  const username = parsed.data.username.toLowerCase()
  const bio = parsed.data.bio?.trim() ? parsed.data.bio.trim() : null

  // Unicité (UX) ; la contrainte UNIQUE(username) reste le garde-fou réel.
  const taken = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, username), ne(user.id, session.user.id)))
    .limit(1)
  if (taken.length > 0) {
    return { success: false, error: "Ce nom d'utilisateur est déjà pris !" }
  }

  try {
    await db
      .update(user)
      .set({ name, username, bio })
      .where(eq(user.id, session.user.id))
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return { success: false, error: "Ce nom d'utilisateur est déjà pris !" }
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[updateProfile]", error)
    }
    return { success: false, error: "Erreur serveur. Réessayez." }
  }

  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  revalidatePath("/dashboard/onboarding")
  return { success: true }
}
