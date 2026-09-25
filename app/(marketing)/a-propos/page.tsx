import { Metadata } from "next"
import { MARKETING_CLAIMS } from "@/constants"
import { getCachedMarketingStats } from "@/features/marketing/cached"
import AProposPageClient from "./_components/a-propos-page-client"

export const metadata: Metadata = {
  title: "À propos",
  description: `Découvrez NOMAQbanq : notre mission, notre équipe et notre engagement envers la communauté médicale francophone. ${MARKETING_CLAIMS.successRate} de taux de réussite, des milliers de candidats accompagnés.`,
  alternates: {
    canonical: "https://nomaqbanq.ca/a-propos",
    languages: {
      "fr-CA": "https://nomaqbanq.ca/a-propos",
    },
  },
  openGraph: {
    title: "À propos de NOMAQbanq",
    description: `Notre mission : accompagner les médecins francophones vers la réussite à l'EACMC. ${MARKETING_CLAIMS.successRate} de taux de réussite, des milliers de candidats satisfaits.`,
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - À propos de notre équipe",
      },
    ],
  },
}

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

export default async function AProposPage() {
  const stats = await getCachedMarketingStats()
  return <AProposPageClient stats={stats} />
}
