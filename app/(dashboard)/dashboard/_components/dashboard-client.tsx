"use client"

import { Brain, CheckCircle2, Percent, Target } from "lucide-react"

import type {
  MyAvailableExam,
  MyDashboardStats,
  MyRecentExam,
  MyScoreHistoryItem,
} from "@/features/exams/dal"
import type { AccessStatus } from "@/features/payments/dal"
import type {
  TrainingScoreHistory,
  TrainingStats,
} from "@/features/training/dal"

import { DashboardHero } from "./dashboard-hero"
import { NextActionsPanel } from "./next-actions-panel"
import { QuickAccessGrid } from "./quick-access-grid"
import { RecentActivityFeed } from "./recent-activity-feed"
import { ScoreEvolutionChart } from "./score-evolution-chart"
import { TrainingScoreChart } from "./training-score-chart"
import { VitalCard } from "./vital-card"

interface DashboardClientProps {
  userName?: string
  isAdmin: boolean
  /** Horloge serveur (render) — passée en prop pour éviter Date.now() au rendu. */
  now: number
  stats: MyDashboardStats
  availableExams: MyAvailableExam[]
  recentExams: MyRecentExam[]
  scoreHistory: MyScoreHistoryItem[]
  accessStatus: AccessStatus | null
  trainingStats: TrainingStats
  trainingScoreHistory: TrainingScoreHistory
}

/**
 * Présentation du dashboard étudiant. Reçoit les données déjà chargées par le
 * Server Component parent (DAL Drizzle) — remplace les `useQuery` Convex. Wrapper
 * client car les cartes/graphiques utilisent `motion` et passent des composants
 * d'icône en props (non sérialisables à travers la frontière serveur→client).
 */
export const DashboardClient = ({
  userName,
  isAdmin,
  now,
  stats,
  availableExams,
  recentExams,
  scoreHistory,
  accessStatus,
  trainingStats,
  trainingScoreHistory,
}: DashboardClientProps) => {
  const completionRate =
    stats.availableExamsCount > 0
      ? Math.round((stats.completedExamsCount / stats.availableExamsCount) * 100)
      : 0

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      {/* Hero Section */}
      <DashboardHero
        userName={userName}
        averageScore={stats.averageScore}
        hasCompletedExams={stats.completedExamsCount > 0}
        accessStatus={accessStatus}
      />

      {/* Vital Cards Section */}
      <div className="space-y-4">
        <h3 className="font-display text-sm font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
          Vitaux principaux
        </h3>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <VitalCard
            label="Score moyen"
            value={stats.completedExamsCount > 0 ? `${stats.averageScore}%` : "—"}
            icon={Percent}
            color="blue"
            delay={0.1}
            subtitle={
              stats.completedExamsCount > 0 ? "Sur vos examens" : "Aucun examen"
            }
          />

          <VitalCard
            label="Examens complétés"
            value={stats.completedExamsCount}
            icon={CheckCircle2}
            color="green"
            delay={0.2}
            subtitle={`sur ${stats.availableExamsCount} disponibles`}
          />

          <VitalCard
            label="Taux de complétion"
            value={`${completionRate}%`}
            icon={Target}
            color="amber"
            delay={0.3}
            subtitle="Progression globale"
          />

          <VitalCard
            label="Entraînements"
            value={trainingStats?.totalSessions ?? 0}
            icon={Brain}
            color="purple"
            delay={0.4}
            subtitle={
              trainingStats && trainingStats.totalSessions > 0
                ? `${trainingStats.totalQuestions} questions pratiquées`
                : "Aucune session"
            }
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-8 lg:grid-cols-2">
        <ScoreEvolutionChart data={scoreHistory} />
        <TrainingScoreChart
          sessions={trainingScoreHistory.sessions}
          domainPerformance={trainingScoreHistory.domainPerformance}
        />
      </div>

      {/* Actions & Activity Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Next Actions */}
        <NextActionsPanel
          completedExamsCount={stats.completedExamsCount}
          averageScore={stats.averageScore}
          availableExams={availableExams}
          trainingStats={trainingStats ?? undefined}
        />

        {/* Recent Activity */}
        <RecentActivityFeed
          recentExams={recentExams}
          now={now}
          isAdmin={isAdmin}
        />
      </div>

      {/* Quick Access */}
      <QuickAccessGrid />
    </div>
  )
}
