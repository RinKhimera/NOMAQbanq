import { Metadata } from "next"
import { MARKETING_CLAIMS } from "@/constants"
import { getMarketingStats } from "@/features/marketing/dal"
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

// Stats quasi statiques : page régénérée au plus toutes les heures (ISR).
export const revalidate = 3600

export default async function AProposPage() {
  const stats = await getMarketingStats()
  return <AProposPageClient stats={stats} />
}
