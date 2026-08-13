import { Metadata } from "next"
import { getMarketingStats } from "@/features/marketing/dal"
import { getAccessStatus, getAvailableProducts } from "@/features/payments/dal"
import { getCurrentSession } from "@/lib/dal"
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

export default async function TarifsPage() {
  // Produits publics + accès courant (null si visiteur non connecté) + stats.
  // Page dynamique (session via getAccessStatus) : pas d'ISR ici.
  // `isAuthenticated` descend en prop plutôt que d'être lu côté client : la
  // session n'est pas résolue au SSR, un rendu qui en dépend produit deux
  // arbres DOM différents à l'hydratation.
  const [products, accessStatus, stats, session] = await Promise.all([
    getAvailableProducts(),
    getAccessStatus(),
    getMarketingStats(),
    getCurrentSession(),
  ])
  return (
    <TarifsPageClient
      products={products}
      accessStatus={accessStatus}
      stats={stats}
      isAuthenticated={!!session?.user}
    />
  )
}
