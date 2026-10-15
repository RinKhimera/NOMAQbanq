import { DOMAINS, domainBySlug } from "@/constants/domains"
import { ogCard } from "@/lib/og-card"
import { OG_SIZE } from "@/lib/seo"

// Texte alternatif commun aux domaines : un `alt` par domaine exigerait
// `generateImageMetadata`, dont le `generateStaticParams` généré par Next
// entre en conflit avec celui-ci et laisse les images non prérendues (404).
export const alt = "QCM pour l'EACMC Partie I, par domaine médical"
export const size = OG_SIZE
export const contentType = "image/png"

// Comme la page : une image par domaine, générée au build ; un slug hors
// liste est un 404, jamais un rendu à la demande.
export const dynamicParams = false

export function generateStaticParams() {
  return DOMAINS.map((d) => ({ slug: d.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const domain = domainBySlug((await params).slug)
  return ogCard(domain?.name ?? "Domaines médicaux")
}
