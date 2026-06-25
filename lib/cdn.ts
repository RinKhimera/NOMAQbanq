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
