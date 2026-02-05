import { Metadata } from "next"
import AProposPageClient from "./_components/a-propos-page-client"

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez NOMAQbanq : notre mission, notre équipe et notre engagement envers la communauté médicale francophone. 85% de taux de réussite, des milliers de candidats accompagnés.",
  alternates: {
    canonical: "https://nomaqbanq.ca/a-propos",
    languages: {
      "fr-CA": "https://nomaqbanq.ca/a-propos",
    },
  },
  openGraph: {
    title: "À propos de NOMAQbanq",
    description:
      "Notre mission : accompagner les médecins francophones vers la réussite à l'EACMC. 85% de taux de réussite, des milliers de candidats satisfaits.",
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

export default function AProposPage() {
  return <AProposPageClient />
}
