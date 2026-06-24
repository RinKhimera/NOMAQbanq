// URL d'affichage publique d'un objet média, dérivée de son `storagePath`.
// L'hôte est public (déclaré dans next.config images domains). Défaut = CDN prod.
export const CDN_HOST =
  process.env.NEXT_PUBLIC_CDN_HOSTNAME ?? "cdn.nomaqbanq.ca"

export const cdnUrl = (storagePath: string): string =>
  `https://${CDN_HOST}/${storagePath.replace(/^\/+/, "")}`
