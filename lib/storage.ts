import "server-only"

import { deleteFromS3 } from "@/lib/aws"
import { CDN_HOST } from "@/lib/cdn"
import { env } from "@/lib/env/server"

/**
 * Couche stockage médias (server-only) : config, sécurité des chemins, helpers
 * de chemins dérivés serveur, validation, et suppression best-effort. Les I/O
 * réseau S3 (presign, delete) sont dans `lib/aws.ts`. Porté de `lib/bunny.ts`.
 */

/** `true` si les trois vars S3 sont présentes (upload possible). */
export const isStorageConfigured = (): boolean =>
  Boolean(env.AWS_REGION && env.AWS_ROLE_ARN && env.S3_BUCKET)

// ---------- Path safety (anti path-traversal / SSRF) ----------

const hasControlOrSpace = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x20) return true
  }
  return false
}

export const assertSafeStoragePath = (storagePath: string): void => {
  if (
    !storagePath ||
    storagePath.startsWith("/") ||
    storagePath.includes("..") ||
    storagePath.includes("\\") ||
    storagePath.includes("//") ||
    hasControlOrSpace(storagePath)
  ) {
    throw new Error(`storagePath invalide: ${storagePath}`)
  }
}

// ---------- Delete (best-effort) ----------

/**
 * Supprime un chemin best-effort : no-op si S3 non configuré, avale toute erreur
 * (chemin invalide, réseau). Pour les flux où l'échec de suppression ne doit pas
 * faire échouer l'action (ancien avatar, orphelin).
 */
export const tryDeleteFromStorage = async (
  storagePath: string,
): Promise<void> => {
  if (!isStorageConfigured()) return
  try {
    assertSafeStoragePath(storagePath)
    await deleteFromS3(storagePath)
  } catch (error) {
    console.error("S3 delete (best-effort) error:", error)
  }
}

// ---------- Path helpers (dérivés serveur) ----------

export const generateQuestionImagePath = (
  questionId: string,
  index: number,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `questions/${questionId}/${Date.now()}-${index}.${cleanExt}`
}

export const generateAvatarPath = (
  userId: string,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `avatars/${userId}/${Date.now()}.${cleanExt}`
}

/**
 * Reconstruit le `storagePath` d'un avatar à partir de son URL stockée UNIQUEMENT
 * si l'URL pointe vers notre CDN (`CDN_HOST`) et le préfixe `avatars/`. `null`
 * pour toute URL externe (Google OAuth, legacy) → la suppression au remplacement
 * ne touche jamais un fichier qui ne nous appartient pas.
 */
export const avatarStoragePathFromUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== CDN_HOST) return null
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "")
    if (!path.startsWith("avatars/") || path.includes("..")) return null
    return path
  } catch {
    return null
  }
}

export const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }
  return mimeToExt[mimeType] || "jpg"
}

// ---------- Validation ----------

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 Mo

/** `null` si valide, message d'erreur FR sinon. */
export const validateImageFile = (
  mimeType: string,
  size: number,
): string | null => {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return "Format non supporté. Utilisez JPG, PNG ou WebP."
  }
  if (size <= 0) return "Fichier vide."
  if (size > MAX_FILE_SIZE) {
    return `Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
  }
  return null
}
