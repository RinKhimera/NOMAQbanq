import { Metadata } from "next"
import { getCachedMarketingStats } from "@/features/marketing/cached"
import HomeLanding from "./_components/home-landing"

export const metadata: Metadata = {
  title: "Préparation EACMC Partie I - 3000+ QCM francophones",
  description:
    "NOMAQbanq : la première plateforme francophone pour préparer l'EACMC Partie I. Plus de 3000 QCM, examens blancs, modes tuteur et chronomètre. Rejoignez des candidats satisfaits.",
  alternates: {
    canonical: "https://nomaqbanq.ca",
    languages: {
      "fr-CA": "https://nomaqbanq.ca",
    },
  },
  openGraph: {
    title: "NOMAQbanq - Préparation EACMC Partie I",
    description:
      "Première plateforme francophone de préparation à l'EACMC. Plus de 3000 QCM, examens blancs et suivi de progression pour réussir votre examen.",
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - Plateforme de préparation EACMC",
      },
    ],
  },
}

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

export default async function Home() {
  const stats = await getCachedMarketingStats()
  return <HomeLanding stats={stats} />
}
