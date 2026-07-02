// URL d'affichage publique d'un objet média, dérivée de son `storagePath`.
// L'hôte est public (déclaré dans next.config images domains). Défaut = CDN prod.
export const CDN_HOST =
  process.env.NEXT_PUBLIC_CDN_HOSTNAME ?? "cdn.nomaqbanq.ca"

export const cdnUrl = (storagePath: string): string =>
  `https://${CDN_HOST}/${storagePath.replace(/^\/+/, "")}`

// Résout une valeur `user.image` polymorphe en URL affichable par next/image :
// - null/vide → null
// - URL déjà absolue (avatar OAuth Google, data:, CDN complet) → telle quelle
// - sinon = clé de stockage S3 (ex. "avatars/<id>/<ts>.jpg") → URL CDN
export const resolveAvatarUrl = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null
  if (/^(https?:)?\/\//.test(value) || value.startsWith("data:")) return value
  return cdnUrl(value)
}

/**
 * Chemin S3 d'un avatar À NOUS à partir d'une valeur `user.image` polymorphe :
 * clé brute (`avatars/…`) telle quelle ; URL http(s) dont le path commence par
 * `avatars/` — quel que soit le host CDN (le delete opère par clé dans le
 * bucket de l'ENV courant : objet d'un autre env absent → no-op). `null` pour
 * tout le reste (URL Google, `data:`, vide) → on ne supprime jamais un fichier
 * qui ne nous appartient pas.
 */
export const avatarStoragePathFromImageValue = (
  value: string | null | undefined,
): string | null => {
  if (!value || value.startsWith("data:")) return null
  let path = value
  if (/^https?:\/\//.test(value)) {
    try {
      path = decodeURIComponent(new URL(value).pathname).replace(/^\/+/, "")
    } catch {
      return null
    }
  }
  if (!path.startsWith("avatars/") || path.includes("..")) return null
  return path
}
