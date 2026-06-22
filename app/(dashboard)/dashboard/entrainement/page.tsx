import { hasAccess } from "@/features/payments/dal"
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
export default async function EntrainementPage() {
  if (!(await hasAccess("training"))) {
    return <TrainingPaywall />
  }

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
    />
  )
}
