import type { Metadata } from "next"
import {
  getMyAvailableExams,
  getMyDashboardStats,
  getMyRecentExams,
  getMyScoreHistory,
} from "@/features/exams/dal"
import { getAccessStatus } from "@/features/payments/dal"
import {
  getMyTrainingScoreHistory,
  getTrainingStats,
} from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { DashboardClient } from "./_components/dashboard-client"
import { DashboardErrorState } from "./_components/dashboard-error-state"

// Horloge isolée du corps de rendu (react-hooks/purity s'applique aussi côté
// Server Component) — passée en prop au lieu d'un Date.now() inline.
const nowMs = () => Date.now()

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function DashboardPage() {
  const session = await getCurrentSession()

  const [
    stats,
    availableExams,
    recentExams,
    scoreHistory,
    accessStatus,
    trainingStats,
    trainingScoreHistory,
  ] = await Promise.all([
    getMyDashboardStats(),
    getMyAvailableExams(),
    getMyRecentExams(),
    getMyScoreHistory(),
    getAccessStatus(),
    getTrainingStats(),
    getMyTrainingScoreHistory(),
  ])

  // Le layout dashboard garde déjà la session ; `stats` n'est null que sans
  // session (cas limite) — état terminal explicite, jamais un squelette.
  if (!stats) return <DashboardErrorState />

  return (
    <DashboardClient
      userName={session?.user?.name}
      isAdmin={session?.user?.role === "admin"}
      now={nowMs()}
      stats={stats}
      availableExams={availableExams}
      recentExams={recentExams}
      scoreHistory={scoreHistory}
      accessStatus={accessStatus}
      trainingStats={trainingStats}
      trainingScoreHistory={trainingScoreHistory}
    />
  )
}
