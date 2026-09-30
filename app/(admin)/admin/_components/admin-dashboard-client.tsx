"use client"

import { Banknote } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed"
import { AlertsPanel } from "@/components/admin/dashboard/alerts-panel"
import { DashboardPanel } from "@/components/admin/dashboard/dashboard-panel"
import { QuickActions } from "@/components/admin/dashboard/quick-actions"
import { ColumnChart } from "@/components/shared/charts/column-chart"
import { ValueBarChart } from "@/components/shared/charts/value-bar-chart"
import { PageIntro } from "@/components/shared/page-intro"
import { ManualPaymentFlow } from "@/components/shared/payments/manual-payment-dialog"
import { StatBand } from "@/components/shared/stat-band"
import { Button } from "@/components/ui/button"
import type { AdminActivity, DashboardTrends } from "@/features/analytics/dal"
import type {
  ExpiringAccessItem,
  ProductView,
  RevenueByDay,
  TransactionStatsView,
} from "@/features/payments/dal"
import type { QuestionStats } from "@/features/questions/dal"
import type { AdminStats } from "@/features/users/dal"
import {
  formatCurrency,
  formatIsoDay,
  formatPercent,
  formatWeekdayLongDate,
} from "@/lib/format"

const TOP_DOMAINS = 8

const trendText = (trend: number) =>
  trend === 0
    ? "stable sur 30 jours"
    : `${formatPercent(trend, { signed: true })} sur 30 jours`

interface AdminDashboardClientProps {
  adminStats: AdminStats
  questionStats: QuestionStats
  transactionStats: TransactionStatsView
  revenueByDay: RevenueByDay
  expiringAccess: ExpiringAccessItem[]
  recentActivity: AdminActivity[]
  dashboardTrends: DashboardTrends
  failedPaymentsCount: number
  products: ProductView[]
  /**
   * Horloge serveur du rendu. La date du bandeau se lit dans le fuseau de
   * l'app : à cheval sur minuit, un `new Date()` local basculerait au jour
   * suivant entre le SSR et l'hydratation et régénérerait l'arbre.
   */
  initialNow: number
}

/**
 * Tableau de bord admin sur les indicateurs existants : bande de chiffres,
 * revenus quotidiens, activité, banque de questions, raccourcis et alertes.
 * Client pour le dialogue de paiement manuel.
 */
export function AdminDashboardClient({
  adminStats,
  questionStats,
  transactionStats,
  revenueByDay,
  expiringAccess,
  recentActivity,
  dashboardTrends,
  failedPaymentsCount,
  products,
  initialNow,
}: AdminDashboardClientProps) {
  const [manual, setManual] = useState(false)
  const cad = (cents: number) => formatCurrency(cents, "CAD", { whole: true })
  const xafRecent = transactionStats.revenueByCurrency.XAF.recent
  const domains = [...questionStats.domainStats]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_DOMAINS)

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <PageIntro
        eyebrow={formatWeekdayLongDate(initialNow)}
        title="Tableau de bord"
        actions={
          <Button type="button" onClick={() => setManual(true)}>
            <Banknote aria-hidden="true" />
            Enregistrer un paiement
          </Button>
        }
      />

      <StatBand
        items={[
          {
            label: "Revenus 30 jours",
            value: cad(transactionStats.revenueByCurrency.CAD.recent),
            sub:
              xafRecent > 0
                ? `XAF : ${formatCurrency(xafRecent, "XAF")}`
                : trendText(dashboardTrends.revenueByCurrency.CAD?.trend ?? 0),
          },
          {
            label: "Utilisateurs",
            value: adminStats.totalUsers.toLocaleString("fr-CA"),
            sub: trendText(dashboardTrends.usersTrend),
          },
          {
            label: "Examens actifs",
            value: adminStats.activeExams,
            sub: `${adminStats.totalExams} examens au total`,
          },
          {
            label: "Accès expirant",
            value: expiringAccess.length,
            sub: "dans les 7 prochains jours",
          },
        ]}
      />

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <DashboardPanel
          eyebrow="Revenus"
          title="Revenus quotidiens"
          description={`${cad(transactionStats.revenueByCurrency.CAD.recent)} sur 30 jours${xafRecent > 0 ? ` · XAF à part : ${formatCurrency(xafRecent, "XAF")}` : ""}`}
        >
          <ColumnChart
            label="Revenus quotidiens en dollars canadiens sur 30 jours"
            format={cad}
            data={revenueByDay.CAD.map((d) => ({
              label: formatIsoDay(d.date),
              value: d.revenue,
            }))}
          />
        </DashboardPanel>
        <ActivityFeed activities={recentActivity} />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <DashboardPanel
          eyebrow="Banque"
          title="Questions par domaine"
          description={`${questionStats.totalCount.toLocaleString("fr-CA")} questions · visible par l'équipe seulement`}
        >
          <ValueBarChart
            label={`Les ${TOP_DOMAINS} domaines les plus fournis`}
            data={domains.map((d) => ({ label: d.domain, value: d.count }))}
          />
          <Button asChild variant="ghost" size="sm" className="self-start">
            <Link href="/admin/questions" prefetch={false}>
              Voir les {questionStats.domainStats.length} domaines
            </Link>
          </Button>
        </DashboardPanel>
        <div className="flex flex-col gap-3">
          <QuickActions onManualPaymentClick={() => setManual(true)} />
          <AlertsPanel
            expiringAccess={expiringAccess}
            failedPaymentsCount={failedPaymentsCount}
          />
        </div>
      </div>

      <ManualPaymentFlow
        open={manual}
        onOpenChange={setManual}
        products={products}
      />
    </div>
  )
}
