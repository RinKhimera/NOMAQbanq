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
  // Une série expirée reste affichée (l'étudiant doit voir qu'elle a expiré)
  // mais ne bloque pas le formulaire : la création la clôt.
  const active = activeSession?.session ?? null
  const expired = activeSession?.isExpired ?? false

  return (
    <>
      {active && (
        <ActiveSeriesCard
          session={active}
          initialNow={initialNow}
          expired={expired}
        />
      )}
      <TrainingConfigForm
        domains={domains.domains}
        totalQuestions={domains.totalQuestions}
        initialDomain={initialDomain}
        initialObjectifs={initialObjectifs}
        hasActiveSeries={active !== null && !expired}
      />
      <TrainingHistorySection initialHistory={initialHistory} />
    </>
  )
}
