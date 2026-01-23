import { Metadata } from "next"
import AProposPageClient from "./_components/a-propos-page-client"

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez NOMAQbanq : notre mission, notre équipe et notre engagement envers la communauté médicale francophone. 85% de taux de réussite, des milliers de candidats accompagnés.",
  alternates: {
    canonical: "https://nomaqbanq.ca/a-propos",
  },
}

export default function AProposPage() {
  return <AProposPageClient />
}
