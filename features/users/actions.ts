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
import {
  avatarStoragePathFromUrl,
  generateAvatarPath,
  getExtensionFromMimeType,
  isBunnyConfigured,
  tryDeleteFromBunny,
  uploadToBunny,
  validateImageFile,
} from "@/lib/bunny"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"

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

export type UploadAvatarResult =
  | { success: true; url: string }
  | { success: false; error: string }

/**
 * Téléverse l'avatar de l'utilisateur courant vers Bunny et met à jour
 * `user.image`. Server Action (CSRF + auth intégrés ; même origine, pas de CORS).
 * Remplace la route Convex HTTP `/api/upload/avatar`.
 *
 * Sécurité : `userId` vient de la session (jamais du client) → chemin de
 * stockage non falsifiable. Validation content-type/taille avant upload.
 * Rate-limit 5/h consommé atomiquement. L'ancien avatar n'est supprimé du CDN
 * que s'il était hébergé chez nous (best-effort).
 */
export const uploadAvatar = async (
  formData: FormData,
): Promise<UploadAvatarResult> => {
  const session = await requireSession()
  const userId = session.user.id

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { success: false, error: "Fichier manquant" }
  }

  const validationError = validateImageFile(file.type, file.size)
  if (validationError) {
    return { success: false, error: validationError }
  }

  if (!isBunnyConfigured()) {
    return {
      success: false,
      error: "Le téléversement d'images n'est pas configuré.",
    }
  }

  const limit = await consumeUploadRateLimit(userId, "avatar")
  if (!limit.allowed) {
    return {
      success: false,
      error: `Limite d'uploads atteinte. Réessayez dans ${limit.retryAfterMinutes} minute(s).`,
    }
  }

  // Ancien avatar (pour suppression CDN au remplacement).
  const [current] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const storagePath = generateAvatarPath(
    userId,
    getExtensionFromMimeType(file.type),
  )

  const result = await uploadToBunny(await file.arrayBuffer(), storagePath)
  if (!result.success) {
    return { success: false, error: result.error }
  }

  try {
    await db.update(user).set({ image: result.url }).where(eq(user.id, userId))
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[uploadAvatar]", error)
    }
    // L'objet est déjà sur le CDN mais le profil n'a pas été mis à jour :
    // nettoyer pour ne pas laisser d'orphelin.
    await tryDeleteFromBunny(storagePath)
    return { success: false, error: "Erreur serveur. Réessayez." }
  }

  // Supprime l'ancien avatar uniquement s'il nous appartient (CDN Bunny).
  const oldPath = avatarStoragePathFromUrl(current?.image)
  if (oldPath && oldPath !== storagePath) {
    await tryDeleteFromBunny(oldPath)
  }

  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true, url: result.url }
}
