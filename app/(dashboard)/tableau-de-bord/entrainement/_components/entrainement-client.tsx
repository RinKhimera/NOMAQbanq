"use client"

import type {
  ActiveTrainingSession,
  DomainsView,
  ObjectifsView,
  TrainingHistoryPage,
} from "@/features/training/dal"
import { ActiveSeriesCard } from "./active-series-card"
import { TrainingConfigForm } from "./training-config-form"
import { TrainingHistorySection } from "./training-history-section"

interface EntrainementClientProps {
  activeSession: ActiveTrainingSession
  domains: DomainsView
  /** Domaine demandé par l'URL, déjà validé par la page ; `null` = tous. */
  initialDomain: string | null
  /** Objectifs du domaine demandé, chargés par la page. */
  initialObjectifs: ObjectifsView["objectifs"]
  initialHistory: TrainingHistoryPage
  /** Horloge serveur du rendu : « Commencée il y a » et « Expire dans » s'y ancrent. */
  initialNow: number
}

export function EntrainementClient({
  activeSession,
  domains,
  initialDomain,
  initialObjectifs,
  initialHistory,
  initialNow,
}: EntrainementClientProps) {
  const active = activeSession?.canResume ? activeSession.session : null

  return (
    <>
      {active && <ActiveSeriesCard session={active} initialNow={initialNow} />}
      <TrainingConfigForm
        domains={domains.domains}
        totalQuestions={domains.totalQuestions}
        initialDomain={initialDomain}
        initialObjectifs={initialObjectifs}
        hasActiveSeries={active !== null}
      />
      <TrainingHistorySection initialHistory={initialHistory} />
    </>
  )
}
