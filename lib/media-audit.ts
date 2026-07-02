// Logique PURE de l'audit médias — AUCUN import `server-only`/env serveur :
// consommée par le script standalone `scripts/audit-medias.ts` ET testée en unit.
import { avatarStoragePathFromImageValue } from "@/lib/cdn"

export type ImageValueKind =
  | "empty"
  | "data"
  | "google"
  | "cdn-url"
  | "raw-key"
  | "external"

/** Classe une valeur `user.image` polymorphe (inventaire d'audit). */
export const classifyImageValue = (
  value: string | null | undefined,
): ImageValueKind => {
  if (!value) return "empty"
  if (value.startsWith("data:")) return "data"
  if (/^https?:\/\//.test(value)) {
    try {
      const url = new URL(value)
      if (url.hostname.endsWith("googleusercontent.com")) return "google"
      const path = url.pathname.replace(/^\/+/, "")
      if (path.startsWith("avatars/") || path.startsWith("questions/")) {
        return "cdn-url"
      }
      return "external"
    } catch {
      return "external"
    }
  }
  if (value.startsWith("avatars/")) return "raw-key"
  return "external"
}

export type MediaDiff = { orphans: string[]; broken: string[] }

/**
 * Diff clé-à-clé : `orphans` = objets S3 sans référence DB ;
 * `broken` = références DB sans objet S3 (liens cassés).
 */
export const diffMediaRefs = (
  s3Keys: Iterable<string>,
  dbPaths: Iterable<string>,
): MediaDiff => {
  const s3 = new Set(s3Keys)
  const refs = new Set(dbPaths)
  const orphans: string[] = []
  for (const key of s3) if (!refs.has(key)) orphans.push(key)
  const broken: string[] = []
  for (const path of refs) if (!s3.has(path)) broken.push(path)
  return { orphans: orphans.sort(), broken: broken.sort() }
}

/** Clés S3 référencées par un lot de `user.image` (nos avatars uniquement, dédupliquées). */
export const referencedAvatarKeys = (
  images: Array<string | null | undefined>,
): string[] => {
  const keys = new Set<string>()
  for (const img of images) {
    const key = avatarStoragePathFromImageValue(img)
    if (key) keys.add(key)
  }
  return [...keys].sort()
}
