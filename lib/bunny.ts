import "server-only"

import { env } from "@/lib/env/server"

/**
 * Service Bunny.net — upload/suppression des médias (avatars, images de
 * questions). Porté depuis `convex/lib/bunny.ts` (Phase 7d). Lit la config
 * depuis l'env serveur validé (`@/lib/env/server`) ; les trois vars sont
 * optionnelles et tout-ou-rien (cf. `lib/env/schema.ts`).
 *
 * Les URLs d'affichage pures sont dérivées du `storagePath` via `lib/cdn.ts`
 * (`cdnUrl`). Ce module est `server-only` : ni l'API key ni les chemins de
 * stockage ne fuient dans le bundle client.
 */

// ============================================
// TYPES
// ============================================

export type BunnyUploadResult = {
  success: true
  url: string
  storagePath: string
}

export type BunnyUploadError = {
  success: false
  error: string
}

export type BunnyResult = BunnyUploadResult | BunnyUploadError

// ============================================
// CONFIGURATION
// ============================================

/** `true` si les trois vars Bunny sont présentes (déduit du `.refine` env). */
export const isBunnyConfigured = (): boolean =>
  Boolean(
    env.BUNNY_STORAGE_ZONE_NAME &&
      env.BUNNY_STORAGE_API_KEY &&
      env.BUNNY_CDN_HOSTNAME,
  )

const getBunnyConfig = () => {
  const storageZoneName = env.BUNNY_STORAGE_ZONE_NAME
  const apiKey = env.BUNNY_STORAGE_API_KEY
  const cdnHostname = env.BUNNY_CDN_HOSTNAME

  if (!storageZoneName || !apiKey || !cdnHostname) {
    throw new Error(
      "Configuration Bunny manquante. Vérifiez BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_API_KEY et BUNNY_CDN_HOSTNAME.",
    )
  }

  return {
    storageZoneName,
    apiKey,
    storageHostname: "storage.bunnycdn.com",
    cdnHostname,
  }
}

// ============================================
// PATH SAFETY (anti path-traversal / SSRF)
// ============================================

// Vrai si la chaîne contient un caractère de contrôle ou une espace
// (codepoint <= U+0020) ; n'affecte PAS le trait d'union (U+002D), légitime
// dans `${timestamp}-${index}`.
const hasControlOrSpace = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x20) return true
  }
  return false
}

/**
 * Refuse tout `storagePath` qui pourrait sortir de la zone de stockage ou
 * réécrire l'URL d'upload (path traversal). Les chemins légitimes sont générés
 * serveur (`generate*Path`) à partir d'ids validés ; cette garde est une
 * défense en profondeur contre un appelant hostile.
 */
const assertSafeStoragePath = (storagePath: string): void => {
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

// ============================================
// UPLOAD
// ============================================

/**
 * Upload un fichier vers Bunny Storage (PUT). Renvoie l'URL CDN publique ou une
 * erreur structurée (pas de throw réseau).
 */
export const uploadToBunny = async (
  fileData: ArrayBuffer | Uint8Array,
  storagePath: string,
): Promise<BunnyResult> => {
  const config = getBunnyConfig()
  assertSafeStoragePath(storagePath)

  const uploadUrl = `https://${config.storageHostname}/${config.storageZoneName}/${storagePath}`

  const bodyData =
    fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData)

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: config.apiKey,
        "Content-Type": "application/octet-stream",
      },
      body: bodyData as unknown as BodyInit,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Bunny upload failed: ${response.status} - ${errorText}`)

      if (response.status === 401) {
        return {
          success: false,
          error: "Authentification Bunny échouée. Vérifiez l'API key.",
        }
      }

      return {
        success: false,
        error: `Échec de l'upload: ${response.status}`,
      }
    }

    return {
      success: true,
      url: `https://${config.cdnHostname}/${storagePath}`,
      storagePath,
    }
  } catch (error) {
    console.error("Bunny upload error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur réseau",
    }
  }
}

// ============================================
// DELETE
// ============================================

/**
 * Supprime un fichier de Bunny Storage (DELETE). `true` si supprimé ou déjà
 * absent (404), `false` sinon.
 */
export const deleteFromBunny = async (
  storagePath: string,
): Promise<boolean> => {
  const config = getBunnyConfig()
  assertSafeStoragePath(storagePath)

  const deleteUrl = `https://${config.storageHostname}/${config.storageZoneName}/${storagePath}`

  try {
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { AccessKey: config.apiKey },
    })

    if (!response.ok && response.status !== 404) {
      console.error(`Bunny delete failed: ${response.status}`)
      return false
    }

    // 200 = supprimé, 404 = déjà absent (les deux OK).
    return true
  } catch (error) {
    console.error("Bunny delete error:", error)
    return false
  }
}

/**
 * Supprime un chemin best-effort : no-op si Bunny n'est pas configuré et avale
 * toute erreur (chemin invalide, réseau). À utiliser dans les flux où l'échec de
 * suppression CDN ne doit pas faire échouer l'action (nettoyage d'orphelins).
 */
export const tryDeleteFromBunny = async (
  storagePath: string,
): Promise<void> => {
  if (!isBunnyConfigured()) return
  try {
    await deleteFromBunny(storagePath)
  } catch (error) {
    console.error("Bunny delete (best-effort) error:", error)
  }
}

// ============================================
// PATH HELPERS (chemins dérivés serveur)
// ============================================

/** Chemin unique pour une image de question. `questionId` doit être validé amont. */
export const generateQuestionImagePath = (
  questionId: string,
  index: number,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `questions/${questionId}/${Date.now()}-${index}.${cleanExt}`
}

/** Chemin unique pour un avatar utilisateur. `userId` provient de la session. */
export const generateAvatarPath = (
  userId: string,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `avatars/${userId}/${Date.now()}.${cleanExt}`
}

/**
 * Reconstruit le `storagePath` d'un avatar à partir de son URL stockée, UNIQUEMENT
 * si l'URL pointe vers notre CDN Bunny et le préfixe `avatars/`. Renvoie `null`
 * pour toute URL externe (avatar Google OAuth, legacy Clerk…) → la suppression
 * au remplacement ne touche jamais un fichier qui ne nous appartient pas.
 */
export const avatarStoragePathFromUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url || !env.BUNNY_CDN_HOSTNAME) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== env.BUNNY_CDN_HOSTNAME) return null
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "")
    if (!path.startsWith("avatars/") || path.includes("..")) return null
    return path
  } catch {
    return null
  }
}

/** Extension de fichier dérivée du type MIME (jamais de l'input client brut). */
export const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }
  return mimeToExt[mimeType] || "jpg"
}

// ============================================
// VALIDATION
// ============================================

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
  if (size <= 0) {
    return "Fichier vide."
  }
  if (size > MAX_FILE_SIZE) {
    return `Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
  }
  return null
}
