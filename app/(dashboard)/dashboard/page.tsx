"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { Brain, CheckCircle2, Percent, Target } from "lucide-react"
import { useState } from "react"
import { api } from "@/convex/_generated/api"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { DashboardHero } from "./_components/dashboard-hero"
import { DashboardSkeleton } from "./_components/dashboard-skeleton"
import { NextActionsPanel } from "./_components/next-actions-panel"
import { QuickAccessGrid } from "./_components/quick-access-grid"
import { RecentActivityFeed } from "./_components/recent-activity-feed"
import { ScoreEvolutionChart } from "./_components/score-evolution-chart"
import { TrainingScoreChart } from "./_components/training-score-chart"
import { VitalCard } from "./_components/vital-card"

const DashboardPage = () => {
  const { isAuthenticated } = useConvexAuth()
  const { currentUser, isLoading: userLoading } = useCurrentUser()
  const skip = isAuthenticated ? undefined : ("skip" as const)
  const stats = useQuery(api.examStats.getMyDashboardStats, skip)
  const availableExams = useQuery(api.exams.getMyAvailableExams, skip)
  const recentExams = useQuery(api.examStats.getMyRecentExams, skip)
  const scoreHistory = useQuery(api.examStats.getMyScoreHistory, skip)
  const accessStatus = useQuery(api.payments.getMyAccessStatus, skip)
  const trainingStats = useQuery(api.training.getTrainingStats, skip)
  const trainingScoreHistory = useQuery(
    api.training.getMyTrainingScoreHistory,
    skip,
  )
  const [now] = useState(() => Date.now())

  // Loading state
  if (userLoading || !stats) {
    return <DashboardSkeleton />
  }

  // Calculate completion rate
  const completionRate =
    stats.availableExamsCount > 0
      ? Math.round(
          (stats.completedExamsCount / stats.availableExamsCount) * 100,
        )
      : 0

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      {/* Hero Section */}
      <DashboardHero
        userName={currentUser?.name}
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
            value={
              stats.completedExamsCount > 0 ? `${stats.averageScore}%` : "—"
            }
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
        <ScoreEvolutionChart data={scoreHistory ?? []} />
        <TrainingScoreChart
          sessions={trainingScoreHistory?.sessions ?? []}
          domainPerformance={trainingScoreHistory?.domainPerformance ?? []}
        />
      </div>

      {/* Actions & Activity Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Next Actions */}
        <NextActionsPanel
          completedExamsCount={stats.completedExamsCount}
          averageScore={stats.averageScore}
          availableExams={availableExams ?? []}
          trainingStats={trainingStats ?? undefined}
        />

        {/* Recent Activity */}
        <RecentActivityFeed
          recentExams={recentExams ?? []}
          now={now}
          isAdmin={currentUser?.role === "admin"}
        />
      </div>

      {/* Quick Access */}
      <QuickAccessGrid />
    </div>
  )
}

export default DashboardPage
