// URL d'affichage d'un fichier Bunny CDN dérivée de son `storagePath` (lecture
// seule — l'upload/suppression Bunny relève de la Phase 7). L'hôte est public
// (déjà déclaré dans next.config images domains) ; défaut = CDN de production.
const CDN_HOST =
  process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ?? "cdn.nomaqbanq.ca"

export const cdnUrl = (storagePath: string): string =>
  `https://${CDN_HOST}/${storagePath.replace(/^\/+/, "")}`
