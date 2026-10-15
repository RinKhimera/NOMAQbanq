import { DOMAINS, domainBySlug } from "@/constants/domains"
import { OG_SIZE, ogCard } from "@/lib/og-card"

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
  return ogCard({ title: domain?.name ?? "Domaines médicaux" })
}
