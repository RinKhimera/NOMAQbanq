import type { Metadata } from "next"
import { TRAINING_DOMAIN_PARAM } from "@/constants"
import { getAvailableProducts, hasAccess } from "@/features/payments/dal"
import {
  getActiveTrainingSession,
  getAvailableDomains,
  getAvailableObjectifsCMC,
  getTrainingHistory,
  getTrainingStats,
} from "@/features/training/dal"
import { EntrainementClient } from "./_components/entrainement-client"
import { TrainingPaywall } from "./_components/training-paywall"

// Server Component : garde d'accès training (paywall) + chargement initial
// (session active, domaines, objectifs, stats, 1re page d'historique). Les
// interactions (création, réponses, pagination) passent par des Server Actions.
export const metadata: Metadata = { title: "Entraînement" }

export default async function EntrainementPage({
  searchParams,
}: {
  searchParams: Promise<{ [TRAINING_DOMAIN_PARAM]?: string | string[] }>
}) {
  if (!(await hasAccess("training"))) {
    // Produit d'accès training (non-promo d'abord, promo en repli).
    const products = await getAvailableProducts()
    const trainingProduct =
      products.find(
        (p) => p.accessType === "training" && !p.code.includes("promo"),
      ) ??
      products.find((p) => p.accessType === "training") ??
      null
    return <TrainingPaywall product={trainingProduct} />
  }

  const requestedDomain = (await searchParams)[TRAINING_DOMAIN_PARAM]
  const [activeSession, domains, objectifs, stats, initialHistory] =
    await Promise.all([
      getActiveTrainingSession(),
      getAvailableDomains(),
      getAvailableObjectifsCMC(),
      getTrainingStats(),
      getTrainingHistory({ limit: 5 }),
    ])

  return (
    <EntrainementClient
      activeSession={activeSession}
      domains={domains}
      objectifs={objectifs}
      stats={stats}
      initialHistory={initialHistory}
      initialDomain={
        typeof requestedDomain === "string" ? requestedDomain : undefined
      }
    />
  )
}
