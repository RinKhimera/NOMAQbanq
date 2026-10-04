import type { Metadata } from "next"
import {
  getMyDashboard,
  getMyDomainMastery,
  getMyExamInProgress,
  getMyExamPercentiles,
  getMyRecentActivity,
  getMyRecentParticipations,
} from "@/features/analytics/dal"
import {
  getAccessStatus,
  getAvailableProducts,
  getMyLapsedAccess,
} from "@/features/payments/dal"
import { getCurrentSession } from "@/lib/dal"
import { parsePeriod } from "@/lib/dashboard-period"
import { isNewcomer } from "@/lib/dashboard-summary"
import { formatWeekdayDayMonth } from "@/lib/format"
import { DashboardErrorState } from "./_components/dashboard-error-state"
import { DashboardNew } from "./_components/dashboard-new"
import { DashboardView } from "./_components/dashboard-view"

// Horloge isolée du corps de rendu (react-hooks/purity s'applique aussi côté
// Server Component) : date du jour, temps restant et « Revoir » s'y ancrent.
const nowMs = () => Date.now()

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const period = parsePeriod((await searchParams).periode)
  const session = await getCurrentSession()

  const [
    dashboard,
    access,
    lapsed,
    examInProgress,
    mastery,
    participations,
    percentiles,
    activity,
  ] = await Promise.all([
    getMyDashboard(period),
    getAccessStatus(),
    getMyLapsedAccess(),
    getMyExamInProgress(),
    getMyDomainMastery(),
    getMyRecentParticipations(),
    getMyExamPercentiles(),
    getMyRecentActivity(),
  ])

  // Le layout garde déjà la session ; `null` n'arrive que sans elle (cas
  // limite) — état terminal explicite, jamais un squelette.
  if (!dashboard) return <DashboardErrorState />

  const now = nowMs()
  const isAdmin = session?.user?.role === "admin"
  const firstName = session?.user?.name?.split(" ")[0] || "étudiant"
  const hasAccess = Boolean(access?.examAccess || access?.trainingAccess)

  if (
    isNewcomer({
      isAdmin,
      hasAccess,
      hasHistory: dashboard.hasHistory,
      hasExamInProgress: examInProgress !== null,
      hasLapsedAccess: lapsed.exam !== null || lapsed.training !== null,
    })
  ) {
    return (
      <DashboardNew
        firstName={firstName}
        products={await getAvailableProducts()}
      />
    )
  }

  return (
    <DashboardView
      firstName={firstName}
      eyebrow={formatWeekdayDayMonth(now)}
      period={period}
      dashboard={dashboard}
      access={access}
      lapsed={lapsed}
      examInProgress={examInProgress}
      mastery={mastery}
      participations={participations}
      percentiles={percentiles}
      activity={activity}
      isAdmin={isAdmin}
      now={now}
    />
  )
}
