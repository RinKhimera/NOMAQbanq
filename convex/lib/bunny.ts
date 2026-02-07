/**
 * Service Bunny.net pour l'upload et la gestion des médias
 *
 * Configuration requise (variables d'environnement Convex) :
 * - BUNNY_STORAGE_ZONE_NAME: Nom de la Storage Zone
 * - BUNNY_STORAGE_API_KEY: Mot de passe de la Storage Zone (AccessKey)
 * - BUNNY_CDN_HOSTNAME: Hostname de la Pull Zone (ex: "nomaqbank-media.b-cdn.net")
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

export type ImageOptimizationParams = {
  width?: number
  height?: number
  quality?: number // 0-100, default 85
  crop?: "fit" | "fill" | "scale"
}

// ============================================
// CONFIGURATION
// ============================================

const getConfig = () => {
  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME
  const apiKey = process.env.BUNNY_STORAGE_API_KEY
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME

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
// UPLOAD
// ============================================

/**
 * Upload un fichier vers Bunny Storage
 *
 * @param fileData - Données du fichier en ArrayBuffer ou Uint8Array
 * @param storagePath - Chemin dans le storage (ex: "questions/abc123/image.jpg")
 * @returns Résultat avec URL CDN ou erreur
 */
export const uploadToBunny = async (
  fileData: ArrayBuffer | Uint8Array,
  storagePath: string,
): Promise<BunnyResult> => {
  const config = getConfig()

  // Construire l'URL d'upload
  const uploadUrl = `https://${config.storageHostname}/${config.storageZoneName}/${storagePath}`

  // Convertir en Uint8Array pour compatibilité avec fetch
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

    // Construire l'URL CDN
    const cdnUrl = `https://${config.cdnHostname}/${storagePath}`

    return {
      success: true,
      url: cdnUrl,
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
 * Supprime un fichier de Bunny Storage
 *
 * @param storagePath - Chemin du fichier à supprimer (ex: "questions/abc123/image.jpg")
 * @returns true si supprimé avec succès, false sinon
 */
export const deleteFromBunny = async (
  storagePath: string,
): Promise<boolean> => {
  const config = getConfig()

  const deleteUrl = `https://${config.storageHostname}/${config.storageZoneName}/${storagePath}`

  try {
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        AccessKey: config.apiKey,
      },
    })

    if (!response.ok && response.status !== 404) {
      console.error(`Bunny delete failed: ${response.status}`)
      return false
    }

    // 200 = deleted, 404 = already deleted (both are OK)
    return true
  } catch (error) {
    console.error("Bunny delete error:", error)
    return false
  }
}

// ============================================
// URL HELPERS
// ============================================

/**
 * Génère une URL CDN optimisée avec les paramètres Bunny Optimizer
 *
 * @param baseUrl - URL CDN de base
 * @param params - Paramètres d'optimisation
 * @returns URL avec paramètres de transformation
 */
export const getOptimizedImageUrl = (
  baseUrl: string,
  params: ImageOptimizationParams,
): string => {
  const searchParams = new URLSearchParams()

  if (params.width) searchParams.set("width", params.width.toString())
  if (params.height) searchParams.set("height", params.height.toString())
  if (params.quality) searchParams.set("quality", params.quality.toString())
  if (params.crop) searchParams.set("crop", params.crop)

  const queryString = searchParams.toString()
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

/**
 * Génère une URL thumbnail pour une image
 */
export const getThumbnailUrl = (
  baseUrl: string,
  size: number = 200,
): string => {
  return getOptimizedImageUrl(baseUrl, {
    width: size,
    height: size,
    crop: "fit",
    quality: 80,
  })
}

/**
 * Génère une URL pour affichage standard (questions)
 */
export const getQuestionImageUrl = (baseUrl: string): string => {
  return getOptimizedImageUrl(baseUrl, {
    width: 800,
    quality: 85,
  })
}

/**
 * Génère une URL pour avatar utilisateur
 */
export const getAvatarUrl = (baseUrl: string, size: number = 128): string => {
  return getOptimizedImageUrl(baseUrl, {
    width: size,
    height: size,
    crop: "fit",
    quality: 85,
  })
}

// ============================================
// PATH HELPERS
// ============================================

/**
 * Génère un chemin unique pour une image de question
 */
export const generateQuestionImagePath = (
  questionId: string,
  index: number,
  extension: string,
): string => {
  const timestamp = Date.now()
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `questions/${questionId}/${timestamp}-${index}.${cleanExt}`
}

/**
 * Génère un chemin unique pour un avatar utilisateur
 */
export const generateAvatarPath = (
  userId: string,
  extension: string,
): string => {
  const timestamp = Date.now()
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `avatars/${userId}/${timestamp}.${cleanExt}`
}

/**
 * Extrait l'extension d'un fichier à partir de son type MIME
 */
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
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Valide un fichier image avant upload
 *
 * @param mimeType - Type MIME du fichier
 * @param size - Taille en bytes
 * @returns null si valide, message d'erreur sinon
 */
export const validateImageFile = (
  mimeType: string,
  size: number,
): string | null => {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return `Format non supporté. Utilisez JPG, PNG ou WebP.`
  }

  if (size > MAX_FILE_SIZE) {
    const maxMB = MAX_FILE_SIZE / (1024 * 1024)
    return `Fichier trop volumineux. Maximum ${maxMB}MB.`
  }

  return null
}
