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
import { DashboardSkeleton } from "./_components/dashboard-skeleton"

// Horloge isolée du corps de rendu (react-hooks/purity s'applique aussi côté
// Server Component) — passée en prop au lieu d'un Date.now() inline.
const nowMs = () => Date.now()

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
  // session (cas limite) — on retombe alors sur le squelette.
  if (!stats) return <DashboardSkeleton />

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
