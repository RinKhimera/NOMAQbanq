import { ArrowRight, ChartNoAxesColumn } from "lucide-react"
import Link from "next/link"
import { ScoreChart } from "@/components/shared/charts/score-chart"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { PageIntro } from "@/components/shared/page-intro"
import { StatBand } from "@/components/shared/stat-band"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PRICING_HREF, TRAINING_HREF } from "@/constants"
import type {
  ExamPercentiles,
  MyDashboard,
  MyExamHistoryPage,
  MyProgression,
} from "@/features/analytics/dal"
import type { DashboardPeriod } from "@/lib/dashboard-period"
import { dashboardSummary, weakestDomain } from "@/lib/dashboard-summary"
import { formatIsoDay } from "@/lib/format"
import { periodEyebrow } from "@/lib/progression"
import { PASS_THRESHOLD, formatScore } from "@/lib/score"
import { DashboardCard } from "../../_components/dashboard-card"
import { PeriodFilter } from "../../_components/period-filter"
import { DomainResults } from "./domain-results"
import { ExamHistory } from "./exam-history"

const TITLE = "Votre progression"

const plural = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`

const points = (trend: number) => {
  const n = Math.abs(trend)
  return `${trend > 0 ? "+" : "−"}${n} ${plural(n, "pt")}`
}

const scoreSub = (trend: number | null) => {
  if (trend === null) return "examens blancs"
  return trend === 0 ? "stable" : points(trend)
}

const activitySub = (period: DashboardPeriod, firstDay: string | null) => {
  if (period !== "tout") return `sur ${period} jours`
  return firstDay ? `depuis le ${formatIsoDay(firstDay)}` : "aucune activité"
}

/** Page sans aucune série close ni examen soumis. */
export const ProgressionEmpty = ({
  trainingAccess,
}: {
  trainingAccess: boolean
}) => (
  <>
    <PageIntro
      eyebrow="Rapport"
      title={TITLE}
      description="Vos résultats par domaine, vos examens blancs et votre entraînement, réunis sur une page."
    />
    <div className="bg-surface border-line shadow-1 rounded-lg border py-10">
      <EmptyState
        icons={[ChartNoAxesColumn]}
        title="Aucune donnée pour le moment"
        description="Votre rapport se remplit dès votre première série d'entraînement ou votre premier examen blanc."
      >
        <Button asChild className="max-md:h-11">
          {trainingAccess ? (
            <Link href={TRAINING_HREF} prefetch={false}>
              Commencer une série
              <LinkPendingIndicator className="ml-2" />
            </Link>
          ) : (
            <Link href={PRICING_HREF}>Voir les tarifs</Link>
          )}
        </Button>
      </EmptyState>
    </div>
  </>
)

type ProgressionViewProps = {
  period: DashboardPeriod
  dashboard: MyDashboard
  progression: MyProgression
  history: MyExamHistoryPage
  percentiles: ExamPercentiles
  isAdmin: boolean
  now: number
}

/** Détail de la progression : chiffres de la période, domaines, examens blancs, entraînement. */
export const ProgressionView = ({
  period,
  dashboard,
  progression,
  history,
  percentiles,
  isAdmin,
  now,
}: ProgressionViewProps) => {
  const { exams, training } = dashboard
  const { activity } = progression

  const weeklyPoints = training.weekly.map((w) => ({
    key: w.weekStart,
    label: formatIsoDay(w.startDay),
    value: w.averageScore,
    detail: `${w.startDay === w.weekStart ? "Semaine du" : "Depuis le"} ${formatIsoDay(w.startDay)} · ${w.sessionCount} ${plural(w.sessionCount, "série")}`,
  }))

  return (
    <>
      <PageIntro
        eyebrow={periodEyebrow(period)}
        title={TITLE}
        description={dashboardSummary({
          period,
          trend: exams.averageTrend,
          weakest: weakestDomain(progression.domains),
        })}
      />

      <PeriodFilter value={period}>
        <StatBand
          items={[
            {
              label: "Score moyen",
              value: formatScore(exams.averageScore),
              sub: scoreSub(exams.averageTrend),
            },
            {
              label: "Examens blancs réussis",
              value:
                exams.periodGradedCount === 0
                  ? "—"
                  : `${exams.periodPassedCount} / ${exams.periodGradedCount}`,
              sub: `seuil ${formatScore(PASS_THRESHOLD)}`,
            },
            {
              label: "Questions pratiquées",
              value: training.questionCount.toLocaleString("fr-CA"),
              sub: `${training.sessionCount} ${plural(training.sessionCount, "série")}`,
            },
            {
              label: "Jours d'activité",
              value: String(activity.days),
              sub: activitySub(period, activity.firstDay),
            },
          ]}
        />

        <DomainResults
          domains={progression.domains}
          period={period}
          trainingAccess={progression.trainingAccess}
        />

        <DashboardCard eyebrow="Historique" title="Examens blancs" flush>
          <ExamHistory
            history={history}
            percentiles={percentiles}
            isAdmin={isAdmin}
            now={now}
          />
        </DashboardCard>

        <DashboardCard
          eyebrow="Entraînement"
          title="Score par semaine"
          action={
            <Button asChild size="sm" variant="ghost" className="max-md:h-11">
              <Link href={TRAINING_HREF} prefetch={false}>
                Historique des séries
                <ArrowRight aria-hidden="true" />
                <LinkPendingIndicator />
              </Link>
            </Button>
          }
        >
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
      </PeriodFilter>
    </>
  )
}
