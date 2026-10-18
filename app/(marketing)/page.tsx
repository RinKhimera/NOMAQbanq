import { Metadata } from "next"
import { MARKETING_PATHS } from "@/constants"
import { getCachedMarketingStats } from "@/features/marketing/cached"
import { SITE_DESCRIPTION, pageMetadata } from "@/lib/seo"
import HomeLanding from "./_components/home-landing"

export const metadata: Metadata = pageMetadata(MARKETING_PATHS.home, {
  title: "Préparation EACMC - 3000+ QCM francophones",
  description:
    "NOMAQbanq, plateforme francophone pour préparer l'EACMC partie 1 : plus de 3000 QCM, examens blancs, modes tuteur et chronométré, suivi de progression.",
  ogTitle: "NOMAQbanq - Préparation EACMC",
  ogDescription: SITE_DESCRIPTION,
})

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

export default async function Home() {
  const stats = await getCachedMarketingStats()
  return <HomeLanding stats={stats} />
}
