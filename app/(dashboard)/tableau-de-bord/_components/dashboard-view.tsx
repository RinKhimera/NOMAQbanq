import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  ClipboardCheck,
  Percent,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { ScoreChart } from "@/components/shared/charts/score-chart"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { PageIntro } from "@/components/shared/page-intro"
import { ScoreRing } from "@/components/shared/score-ring"
import { VitalCard } from "@/components/shared/vital-card"
import { Button } from "@/components/ui/button"
import type {
  ActivityItem,
  DomainMastery,
  ExamInProgress,
  ExamPercentiles,
  MyDashboard,
  RecentParticipation,
} from "@/features/analytics/dal"
import type { AccessStatus, LapsedAccess } from "@/features/payments/dal"
import type { DashboardPeriod } from "@/lib/dashboard-period"
import { dashboardSummary, weakestDomain } from "@/lib/dashboard-summary"
import { formatDayMonth, formatIsoDay } from "@/lib/format"
import { PASS_THRESHOLD, formatScore } from "@/lib/score"
import { DashboardAlerts } from "./dashboard-alerts"
import { DashboardCard } from "./dashboard-card"
import { DomainMasteryPanel } from "./domain-mastery-panel"
import { PeriodFilter } from "./period-filter"
import { RecentActivity } from "./recent-activity"
import { RecentExamsTable } from "./recent-exams-table"

export const GRID_4 =
  "grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-[480px]:grid-cols-1"

const plural = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`

/** Actions de l'en-tête ; les `data-testid` reprennent ceux de l'ancienne grille d'accès rapides. */
export const IntroActions = () => (
  <>
    <Button asChild variant="outline" className="max-md:h-11">
      <Link
        href="/tableau-de-bord/entrainement"
        prefetch={false}
        data-testid="quick-access-Entraînement"
      >
        <BookOpen aria-hidden="true" />
        Nouvelle série
        <LinkPendingIndicator />
      </Link>
    </Button>
    <Button asChild className="max-md:h-11">
      <Link
        href="/tableau-de-bord/examen-blanc"
        prefetch={false}
        data-testid="quick-access-Examens blancs"
      >
        Démarrer un examen blanc
        <ArrowRight aria-hidden="true" />
        <LinkPendingIndicator />
      </Link>
    </Button>
  </>
)

type DashboardViewProps = {
  firstName: string
  eyebrow: ReactNode
  period: DashboardPeriod
  dashboard: MyDashboard
  access: AccessStatus | null
  lapsed: LapsedAccess
  examInProgress: ExamInProgress | null
  mastery: DomainMastery[]
  participations: RecentParticipation[]
  percentiles: ExamPercentiles
  activity: ActivityItem[]
  isAdmin: boolean
  now: number
}

/** Tableau de bord d'un étudiant qui a un accès ou un historique. */
export const DashboardView = ({
  firstName,
  eyebrow,
  period,
  dashboard,
  access,
  lapsed,
  examInProgress,
  mastery,
  participations,
  percentiles,
  activity,
  isAdmin,
  now,
}: DashboardViewProps) => {
  const { exams, training } = dashboard
  // Numérateur et dénominateur sur le même ensemble d'examens : jamais au-delà
  // de 100 %, aucun plafond à poser.
  const completionRate =
    exams.availableCount > 0
      ? Math.floor(
          (exams.completedOfAvailableCount / exams.availableCount) * 100,
        )
      : null

  const examPoints = exams.history.map((h) => ({
    key: h.examId,
    label: formatDayMonth(h.completedAt),
    value: h.score,
    detail: h.title,
  }))
  const weeklyPoints = training.weekly.map((w) => ({
    key: w.weekStart,
    label: formatIsoDay(w.weekStart),
    value: w.averageScore,
    detail: `Semaine du ${formatIsoDay(w.weekStart)} · ${w.sessionCount} ${plural(w.sessionCount, "série")}`,
  }))

  return (
    <>
      <PageIntro
        eyebrow={eyebrow}
        title={`Bonjour ${firstName}.`}
        description={dashboardSummary({
          period,
          trend: exams.averageTrend,
          weakest: weakestDomain(mastery),
        })}
        actions={<IntroActions />}
      />

      <DashboardAlerts
        examInProgress={examInProgress}
        access={access}
        lapsed={lapsed}
        now={now}
      />

      <PeriodFilter value={period}>
        <div className={GRID_4}>
          <VitalCard
            label="Score moyen"
            value={
              exams.averageScore === null ? "—" : String(exams.averageScore)
            }
            unit="%"
            icon={Percent}
            trend={exams.averageTrend}
            subtitle="examens blancs"
          />
          <VitalCard
            label="Examens complétés"
            value={String(exams.completedCount)}
            icon={ClipboardCheck}
            subtitle={
              exams.availableCount > 0
                ? `sur ${exams.availableCount} ${plural(exams.availableCount, "disponible")}`
                : "aucun examen disponible"
            }
          />
          <VitalCard
            label="Entraînements"
            value={String(training.sessionCount)}
            icon={BookOpen}
            subtitle={`${training.questionCount.toLocaleString("fr-CA")} ${plural(training.questionCount, "question")} ${plural(training.questionCount, "pratiquée")}`}
          />
          <VitalCard
            label="Taux de complétion"
            value={completionRate === null ? "—" : String(completionRate)}
            unit="%"
            icon={CircleCheck}
            subtitle="examens complétés / accessibles"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <DashboardCard eyebrow="Examens blancs" title="Évolution du score">
            <ScoreChart
              data={examPoints}
              label="Évolution du score aux examens blancs"
              empty={{
                title: "Aucun examen blanc sur la période",
                description: "Vos scores d'examens blancs s'afficheront ici.",
              }}
            />
          </DashboardCard>
          <DashboardCard eyebrow="Entraînement" title="Score par semaine">
            <ScoreChart
              data={weeklyPoints}
              label="Score moyen des séries par semaine"
              empty={{
                title: "Aucune série close sur la période",
                description:
                  "Chaque semaine avec au moins une série ajoute un point.",
              }}
            />
          </DashboardCard>
        </div>
      </PeriodFilter>

      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3 max-lg:grid-cols-1">
        <DashboardCard eyebrow="Maîtrise" title="Par domaine">
          <DomainMasteryPanel domains={mastery} />
        </DashboardCard>
        <DashboardCard eyebrow="Objectif" title="Prêt pour l'examen">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
            <ScoreRing
              value={exams.overallAverage}
              size={148}
              strokeWidth={8}
              valueTestId="readiness-score"
            />
            <p className="text-ink-2 max-w-65 text-center text-[0.8125rem] leading-normal">
              Seuil de réussite : {formatScore(PASS_THRESHOLD)}.{" "}
              {exams.gradedCount === 0 ? (
                "Aucun examen blanc corrigé pour l'instant."
              ) : (
                <>
                  <span
                    className="text-ink font-mono"
                    data-testid="readiness-passed"
                  >
                    {exams.passedCount} / {exams.gradedCount}
                  </span>{" "}
                  {exams.gradedCount > 1
                    ? "examens blancs réussis."
                    : "examen blanc réussi."}
                </>
              )}
            </p>
          </div>
        </DashboardCard>
      </div>

      <DashboardCard eyebrow="Historique" title="Examens récents" flush>
        <RecentExamsTable
          participations={participations}
          percentiles={percentiles}
          isAdmin={isAdmin}
          now={now}
        />
      </DashboardCard>

      <DashboardCard eyebrow="Activité" title="Dernières actions">
        <RecentActivity items={activity} />
      </DashboardCard>
    </>
  )
}
