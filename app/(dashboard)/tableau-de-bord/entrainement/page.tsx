import type { Metadata } from "next"
import { PageIntro } from "@/components/shared/page-intro"
import { AccessPaywall } from "@/components/shared/payments/access-paywall"
import { TRAINING_DOMAIN_PARAM } from "@/constants"
import {
  getAvailableProducts,
  getMyLapsedAccess,
  hasAccess,
} from "@/features/payments/dal"
import {
  getActiveTrainingSession,
  getAvailableDomains,
  getAvailableObjectifsCMC,
  getTrainingHistory,
} from "@/features/training/dal"
import { currentTimeMs } from "@/lib/clock"
import { cheapestMonthly } from "@/lib/pricing"
import { EntrainementClient } from "./_components/entrainement-client"

export const TRAINING_INTRO = {
  eyebrow: "Entraînement",
  title: "Séries d'entraînement",
  description:
    "Composez une série de 5 à 20 questions et choisissez votre mode de correction.",
}

// Server Component : garde d'accès training (paywall, ou accès échu) +
// chargement initial (série en cours, domaines, objectifs du domaine demandé,
// 1re page d'historique). Les interactions passent par des Server Actions.
export const metadata: Metadata = { title: "Entraînement" }

export default async function EntrainementPage({
  searchParams,
}: {
  searchParams: Promise<{ [TRAINING_DOMAIN_PARAM]?: string | string[] }>
}) {
  if (!(await hasAccess("training"))) {
    const [products, lapsed] = await Promise.all([
      getAvailableProducts(),
      getMyLapsedAccess(),
    ])
    const monthly =
      cheapestMonthly(products, "training") ?? cheapestMonthly(products)
    return (
      <>
        <PageIntro {...TRAINING_INTRO} />
        <AccessPaywall
          type="training"
          expiredAt={lapsed.training}
          priceFromCents={monthly?.priceCAD ?? null}
        />
      </>
    )
  }

  const requestedDomain = (await searchParams)[TRAINING_DOMAIN_PARAM]
  const [activeSession, domains, initialHistory] = await Promise.all([
    getActiveTrainingSession(),
    getAvailableDomains(),
    getTrainingHistory({ page: 1 }),
  ])
  // Le paramètre d'URL présélectionne toujours ; un domaine inconnu retombe
  // sur « Tous les domaines », sans objectifs à charger.
  const initialDomain =
    typeof requestedDomain === "string" &&
    domains.domains.some((d) => d.domain === requestedDomain)
      ? requestedDomain
      : null
  const initialObjectifs = initialDomain
    ? (await getAvailableObjectifsCMC(initialDomain)).objectifs
    : []

  return (
    <>
      <PageIntro {...TRAINING_INTRO} />
      <EntrainementClient
        activeSession={activeSession}
        domains={domains}
        initialDomain={initialDomain}
        initialObjectifs={initialObjectifs}
        initialHistory={initialHistory}
        initialNow={currentTimeMs()}
      />
    </>
  )
}
