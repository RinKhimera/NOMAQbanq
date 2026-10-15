import { DOMAINS, domainBySlug } from "@/constants/domains"
import { ogCard } from "@/lib/og-card"
import { OG_SIZE } from "@/lib/seo"

// Comme la page : une image par domaine, générée au build ; un slug hors
// liste est un 404, jamais un rendu à la demande.
export const dynamicParams = false

export function generateStaticParams() {
  return DOMAINS.map((d) => ({ slug: d.slug }))
}

// Seul moyen de donner à chaque domaine son texte alternatif : l'export
// `alt` d'un fichier image est le même pour toutes les pages du segment.
export function generateImageMetadata({
  params,
}: {
  params: { slug: string }
}) {
  const domain = domainBySlug(params.slug)
  return [
    {
      id: "partage",
      alt: `${domain?.name ?? "Domaines médicaux"} : QCM pour l'EACMC Partie I`,
      size: OG_SIZE,
      contentType: "image/png",
    },
  ]
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const domain = domainBySlug((await params).slug)
  return ogCard(domain?.name ?? "Domaines médicaux")
}
