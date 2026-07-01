"use server"

import { and, eq, isNull, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { db } from "@/db"
import { session as sessionTable, user } from "@/db/schema"
import {
  type AdminUsersPage,
  type UserPanelData,
  type UsersFilters,
  getUserPanelData,
  getUsersWithFilters,
} from "@/features/users/dal"
import { profileSchema } from "@/features/users/schemas"
import { auth } from "@/lib/auth"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { createPresignedUpload } from "@/lib/aws"
import { cdnUrl } from "@/lib/cdn"
import {
  avatarStoragePathFromUrl,
  generateAvatarPath,
  getExtensionFromMimeType,
  isStorageConfigured,
  tryDeleteFromStorage,
  validateImageFile,
} from "@/lib/storage"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"
import { deleteAccountSchema } from "@/schemas/auth"

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

export type CreateUploadResult =
  | {
      success: true
      url: string
      fields: Record<string, string>
      storagePath: string
    }
  | { success: false; error: string }

/**
 * Étape 1 de l'upload avatar : garde session → validation type/taille →
 * rate-limit (5/h) → presigned POST S3 (`avatars/{userId}/…`). Le `userId` vient
 * de la session (jamais du client) → chemin non falsifiable. Le fichier ne
 * transite PAS par le serveur.
 */
export const createAvatarUpload = async (input: {
  contentType: string
  size: number
}): Promise<CreateUploadResult> => {
  const session = await requireSession()
  const userId = session.user.id

  const validationError = validateImageFile(input.contentType, input.size)
  if (validationError) return { success: false, error: validationError }

  if (!isStorageConfigured()) {
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

  const storagePath = generateAvatarPath(
    userId,
    getExtensionFromMimeType(input.contentType),
  )
  try {
    const { url, fields } = await createPresignedUpload(
      storagePath,
      input.contentType,
    )
    return { success: true, url, fields, storagePath }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[createAvatarUpload]", error)
    }
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}

// Un chemin d'avatar légitime : `avatars/{id}/{timestamp}.{ext}`.
const AVATAR_PATH_RE = /^avatars\/[A-Za-z0-9_-]{1,64}\/\d+\.(jpg|png|webp)$/

/**
 * Étape 2 : après l'upload S3 réussi, persiste `user.image` = `cdnUrl(storagePath)`.
 * Le `storagePath` DOIT appartenir au préfixe de l'utilisateur courant (re-vérifié)
 * → non falsifiable. Supprime l'ancien avatar s'il nous appartient. En cas
 * d'échec DB, nettoie l'objet S3 fraîchement uploadé (pas d'orphelin).
 */
export const confirmAvatarUpload = async (input: {
  storagePath: string
}): Promise<UpdateProfileResult & { url?: string }> => {
  const session = await requireSession()
  const userId = session.user.id

  if (
    !AVATAR_PATH_RE.test(input.storagePath) ||
    !input.storagePath.startsWith(`avatars/${userId}/`)
  ) {
    return { success: false, error: "Chemin d'avatar invalide" }
  }

  const [current] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const newUrl = cdnUrl(input.storagePath)
  try {
    await db.update(user).set({ image: newUrl }).where(eq(user.id, userId))
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[confirmAvatarUpload]", error)
    }
    await tryDeleteFromStorage(input.storagePath)
    return { success: false, error: "Erreur serveur. Réessayez." }
  }

  const oldPath = avatarStoragePathFromUrl(current?.image)
  if (oldPath && oldPath !== input.storagePath) {
    await tryDeleteFromStorage(oldPath)
  }

  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true, url: newUrl }
}

export type AccountActionResult = { success: boolean; error?: string }

// Révoque UNE session de l'utilisateur courant (déconnexion d'un appareil).
// Garde d'appartenance (user_id) → anti-IDOR. Interdit la session courante
// (utiliser la déconnexion normale).
export const revokeUserSession = async (
  sessionId: string,
): Promise<AccountActionResult> => {
  const authSession = await requireSession()
  if (sessionId === authSession.session.id) {
    return {
      success: false,
      error: "Vous ne pouvez pas révoquer votre session courante ici.",
    }
  }
  await db
    .delete(sessionTable)
    .where(
      and(
        eq(sessionTable.id, sessionId),
        eq(sessionTable.userId, authSession.user.id),
      ),
    )
  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}

// Déconnecte tous les autres appareils (garde la session courante).
export const revokeOtherUserSessions =
  async (): Promise<AccountActionResult> => {
    const authSession = await requireSession()
    await db
      .delete(sessionTable)
      .where(
        and(
          eq(sessionTable.userId, authSession.user.id),
          ne(sessionTable.id, authSession.session.id),
        ),
      )
    revalidatePath("/dashboard/profil")
    revalidatePath("/admin/profil")
    return { success: true }
  }

// Définit un mot de passe pour un compte SANS mot de passe (Google-only) → ajoute
// un login email/mot de passe. `setPassword` est server-only côté Better Auth : on
// l'appelle via auth.api depuis cette action gardée.
export const setAccountPassword = async (input: {
  newPassword: string
}): Promise<AccountActionResult> => {
  await requireSession()

  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return {
      success: false,
      error: "Le mot de passe doit contenir entre 8 et 128 caractères.",
    }
  }

  try {
    await auth.api.setPassword({
      body: { newPassword: input.newPassword },
      headers: await headers(),
    })
  } catch {
    return { success: false, error: "Impossible de définir le mot de passe." }
  }

  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}

// Suppression douce du compte courant (grâce 30 j). Confirmation par saisie de
// l'email. Pose `deletedAt`, supprime toutes les sessions (déconnexion partout).
// L'anonymisation définitive est faite plus tard par le cron. La reconnexion dans
// la fenêtre de grâce réactive le compte (voir lib/auth.ts databaseHooks).
export const deleteMyAccount = async (input: {
  confirmEmail: string
}): Promise<AccountActionResult> => {
  const authSession = await requireSession()

  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  if (
    parsed.data.confirmEmail.trim().toLowerCase() !==
    authSession.user.email.toLowerCase()
  ) {
    return { success: false, error: "L'adresse courriel ne correspond pas." }
  }

  // Garde « dernier admin » ATOMIQUE : verrou de ligne (`for update`) sur les
  // admins actifs DANS la transaction → deux derniers admins qui se suppriment en
  // concurrence sont sérialisés (le 2e voit le 1er supprimé et est refusé). Évite
  // le TOCTOU d'un `count` hors transaction (cf. data-layer.md).
  const result = await db.transaction(async (tx) => {
    if (authSession.user.role === "admin") {
      const admins = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), isNull(user.deletedAt)))
        .orderBy(user.id)
        .for("update")
      const hasOtherAdmin = admins.some((a) => a.id !== authSession.user.id)
      if (!hasOtherAdmin) {
        return { ok: false as const }
      }
    }

    await tx
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, authSession.user.id))
    await tx
      .delete(sessionTable)
      .where(eq(sessionTable.userId, authSession.user.id))
    return { ok: true as const }
  })

  if (!result.ok) {
    return {
      success: false,
      error:
        "Vous êtes le dernier administrateur : impossible de supprimer ce compte.",
    }
  }

  return { success: true }
}
