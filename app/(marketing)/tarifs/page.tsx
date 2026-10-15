import { Metadata } from "next"
import { JsonLd } from "@/components/seo/json-ld"
import {
  getCachedAvailableProducts,
  getCachedMarketingStats,
} from "@/features/marketing/cached"
import { getAccessStatus } from "@/features/payments/dal"
import { getCurrentSession } from "@/lib/dal"
import {
  SITE_OG_IMAGE,
  SITE_OPEN_GRAPH,
  SITE_URL,
  offersJsonLd,
} from "@/lib/seo"
import TarifsPageContent from "./_components/tarifs-page"

export const metadata: Metadata = {
  title: "Tarifs de la préparation à l'EACMC Partie I",
  description:
    "Formules NOMAQbanq pour préparer l'EACMC partie 1 : accès à la banque de questions et aux examens blancs, en dollars canadiens. Paiement sécurisé, accès instantané, temps cumulable.",
  alternates: {
    canonical: `${SITE_URL}/tarifs`,
  },
  openGraph: {
    ...SITE_OPEN_GRAPH,
    title: "Tarifs de la préparation à l'EACMC Partie I",
    description:
      "Formules flexibles pour préparer l'EACMC Partie I : banque de questions et examens blancs.",
    images: [SITE_OG_IMAGE],
  },
}

export default async function TarifsRoute({
  searchParams,
}: {
  searchParams: Promise<{ annule?: string }>
}) {
  const { annule } = await searchParams
  // Produits publics + accès courant (null si visiteur non connecté) + stats.
  // Page dynamique (session via getAccessStatus) : pas d'ISR ici.
  // `isAuthenticated` descend en prop plutôt que d'être lu côté client : la
  // session n'est pas résolue au SSR, un rendu qui en dépend produit deux
  // arbres DOM différents à l'hydratation.
  const [products, accessStatus, stats, session] = await Promise.all([
    getCachedAvailableProducts(),
    getAccessStatus(),
    getCachedMarketingStats(),
    getCurrentSession(),
  ])
  return (
    <>
      {products.length > 0 && <JsonLd data={offersJsonLd(products)} />}
      <TarifsPageContent
        products={products}
        accessStatus={accessStatus}
        stats={stats}
        isAuthenticated={!!session?.user}
        checkoutCancelled={annule === "1"}
      />
    </>
  )
}
