import "server-only"
import { deleteFromS3 } from "@/lib/aws"
import { CDN_HOST } from "@/lib/cdn"
import { env } from "@/lib/env/server"

/**
 * Couche stockage médias (server-only) : config, sécurité des chemins, helpers
 * de chemins dérivés serveur, validation, et suppression best-effort. Les I/O
 * réseau S3 (presign, delete) sont dans `lib/aws.ts`. Porté de `lib/bunny.ts`.
 */

/**
 * `true` si S3 est utilisable : région + bucket + des credentials — soit OIDC
 * (`AWS_ROLE_ARN`, prod/preview), soit clés statiques (`AWS_ACCESS_KEY_ID` +
 * `AWS_SECRET_ACCESS_KEY`, dev local).
 */
export const isStorageConfigured = (): boolean =>
  Boolean(
    env.S3_REGION &&
    env.S3_BUCKET &&
    (env.AWS_ROLE_ARN || (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY)),
  )

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

/**
 * Chemin TAMPON (`tmp/questions/{id}/{kind}/…`) pour un upload d'image question
 * avant persistance. L'upload presigned vise ce préfixe ; au save, l'objet est
 * copié vers son chemin final (`questions/{id}/{kind}/…`, cf. `finalPathFromTmp`)
 * et le tmp/ est laissé expirer par une règle Lifecycle S3 → aucun orphelin ne
 * s'accumule jamais dans le vrai dossier (anti-orphelins « approche C »). Le
 * `kind` (`statement`/`explanation`) namespace les deux jeux d'images d'une même
 * question pour éviter toute collision d'index.
 */
export const generateQuestionImageTmpPath = (
  questionId: string,
  kind: "statement" | "explanation",
  index: number,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `tmp/questions/${questionId}/${kind}/${Date.now()}-${index}.${cleanExt}`
}

/**
 * Chemin final dérivé d'un chemin tampon : retire le préfixe `tmp/`
 * (`tmp/questions/{id}/x.jpg` → `questions/{id}/x.jpg`). Idempotent sur un
 * chemin déjà final.
 */
export const finalPathFromTmp = (tmpPath: string): string =>
  tmpPath.startsWith("tmp/") ? tmpPath.slice("tmp/".length) : tmpPath

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
