import type { Metadata } from "next"
import {
  getMyDashboard,
  getMyExamHistory,
  getMyExamPercentiles,
  getMyProgression,
} from "@/features/analytics/dal"
import { currentTimeMs } from "@/lib/clock"
import { getCurrentSession } from "@/lib/dal"
import { parsePeriod } from "@/lib/dashboard-period"
import { AFTER_PARAM, BEFORE_PARAM } from "@/lib/progression"
import { DashboardErrorState } from "../_components/dashboard-error-state"
import {
  ProgressionEmpty,
  ProgressionView,
} from "./_components/progression-view"

export const metadata: Metadata = { title: "Progression" }

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined

// Période (`periode`) et page de l'historique des examens (`apres` / `avant`)
// vivent dans l'URL. Un accès expiré laisse la page entière lisible.
export default async function ProgressionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const period = parsePeriod(params.periode)

  const [session, dashboard, progression, history] = await Promise.all([
    getCurrentSession(),
    getMyDashboard(period),
    getMyProgression(period),
    getMyExamHistory(one(params[AFTER_PARAM]), one(params[BEFORE_PARAM])),
  ])
  // Percentiles de la page affichée seulement.
  const percentiles = await getMyExamPercentiles(
    history.items.map((i) => i.examId),
  )

  // Le layout garde déjà la session ; `null` n'arrive que sans elle.
  if (!dashboard || !progression) return <DashboardErrorState />

  if (!dashboard.hasHistory) {
    return <ProgressionEmpty trainingAccess={progression.trainingAccess} />
  }

  return (
    <ProgressionView
      period={period}
      dashboard={dashboard}
      progression={progression}
      history={history}
      percentiles={percentiles}
      isAdmin={session?.user?.role === "admin"}
      now={currentTimeMs()}
    />
  )
}
