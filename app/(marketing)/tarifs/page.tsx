import { Metadata } from "next"
import TarifsPageClient from "./_components/tarifs-page-client"

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Découvrez nos formules d'abonnement NOMAQbanq : accès à la banque de questions et aux examens blancs. Paiement sécurisé, accès instantané, temps cumulable.",
  alternates: {
    canonical: "https://nomaqbanq.ca/tarifs",
  },
  openGraph: {
    title: "Tarifs et abonnements | NOMAQbanq",
    description:
      "Formules flexibles pour préparer l'EACMC. Banque de questions et examens blancs. Commencez dès aujourd'hui.",
  },
}

export default function TarifsPage() {
  return <TarifsPageClient />
}
