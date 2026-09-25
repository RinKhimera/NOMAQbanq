import { Metadata } from "next"
import { getCachedMarketingStats } from "@/features/marketing/cached"
import DomainesPageClient from "./_components/domaines-page-client"

export const metadata: Metadata = {
  title: "Domaines médicaux",
  description:
    "Explorez nos 23 domaines médicaux : cardiologie, pédiatrie, chirurgie, neurologie et plus. Questions EACMC organisées par spécialité pour une préparation ciblée.",
  alternates: {
    canonical: "https://nomaqbanq.ca/domaines",
    languages: {
      "fr-CA": "https://nomaqbanq.ca/domaines",
    },
  },
  openGraph: {
    title: "Domaines médicaux | NOMAQbanq",
    description:
      "23 domaines médicaux pour préparer l'EACMC : cardiologie, pédiatrie, chirurgie, neurologie. Questions organisées par spécialité.",
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - Domaines médicaux EACMC",
      },
    ],
  },
}

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

export default async function DomainesPage() {
  const stats = await getCachedMarketingStats()
  return <DomainesPageClient stats={stats} />
}
