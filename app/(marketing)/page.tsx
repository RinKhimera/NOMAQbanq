import { Metadata } from "next"
import { getCachedMarketingStats } from "@/features/marketing/cached"
import {
  SITE_DESCRIPTION,
  SITE_OG_IMAGE,
  SITE_OPEN_GRAPH,
  SITE_URL,
} from "@/lib/seo"
import HomeLanding from "./_components/home-landing"

export const metadata: Metadata = {
  title: "Préparation EACMC Partie I - 3000+ QCM francophones",
  description:
    "NOMAQbanq, plateforme francophone pour préparer l'EACMC partie 1 : plus de 3000 QCM, examens blancs, modes tuteur et chronométré, suivi de progression.",
  alternates: {
    canonical: SITE_URL,
    languages: {
      "fr-CA": SITE_URL,
    },
  },
  openGraph: {
    ...SITE_OPEN_GRAPH,
    title: "NOMAQbanq - Préparation EACMC Partie I",
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
}

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

export default async function Home() {
  const stats = await getCachedMarketingStats()
  return <HomeLanding stats={stats} />
}
