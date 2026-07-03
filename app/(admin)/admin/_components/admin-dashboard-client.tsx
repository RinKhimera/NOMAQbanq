"use client"

import { IconLayoutDashboard } from "@tabler/icons-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { motion } from "motion/react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed"
import { AlertsPanel } from "@/components/admin/dashboard/alerts-panel"
import { DomainChart } from "@/components/admin/dashboard/domain-chart"
import { QuickActions } from "@/components/admin/dashboard/quick-actions"
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart"
import { AdminVitalCards } from "@/components/admin/dashboard/vital-cards"
import type { AdminActivity, DashboardTrends } from "@/features/analytics/dal"
import type {
  ExpiringAccessItem,
  RevenueByDay,
  TransactionStatsView,
} from "@/features/payments/dal"
import type { QuestionStats } from "@/features/questions/dal"
import type { AdminStats } from "@/features/users/dal"

// Lazy-load la modale (ssr:false → uniquement dans un composant client).
const ManualPaymentModal = dynamic(
  () =>
    import("@/components/shared/payments/manual-payment-modal").then((mod) => ({
      default: mod.ManualPaymentModal,
    })),
  { ssr: false },
)

interface AdminDashboardClientProps {
  adminStats: AdminStats
  questionStats: QuestionStats
  transactionStats: TransactionStatsView
  revenueByDay: RevenueByDay
  expiringAccess: ExpiringAccessItem[]
  recentActivity: AdminActivity[]
  dashboardTrends: DashboardTrends
  failedPaymentsCount: number
}

/**
 * Présentation du dashboard admin. Reçoit les données déjà chargées par le Server
 * Component parent (DAL Drizzle) — remplace les `useQuery` Convex. Wrapper client
 * car il porte l'état de la modale de paiement manuel et passe des icônes en props.
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
}: AdminDashboardClientProps) {
  const router = useRouter()
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false)
  const [today] = useState(() =>
    format(new Date(), "EEEE d MMMM yyyy", { locale: fr }),
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
      <AdminPageHeader
        icon={IconLayoutDashboard}
        title="Tableau de bord"
        subtitle={today}
        colorScheme="slate"
      />

      {/* Vital cards */}
      <AdminVitalCards
        revenueByCurrency={{
          CAD: {
            recent: transactionStats.revenueByCurrency.CAD.recent,
            trend: dashboardTrends.revenueByCurrency.CAD.trend,
          },
          XAF: {
            recent: transactionStats.revenueByCurrency.XAF.recent,
            trend: dashboardTrends.revenueByCurrency.XAF.trend,
          },
        }}
        usersData={{
          total: adminStats.totalUsers,
          trend: dashboardTrends.usersTrend,
        }}
        activeExams={adminStats.activeExams}
        expiringAccessCount={expiringAccess.length}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <RevenueChart data={revenueByDay} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <ActivityFeed activities={recentActivity} />
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <DomainChart
            data={questionStats.domainStats}
            totalQuestions={questionStats.totalCount}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col gap-4"
        >
          <QuickActions
            onManualPaymentClick={() => setShowManualPaymentModal(true)}
          />
          <AlertsPanel
            expiringAccess={expiringAccess}
            failedPaymentsCount={failedPaymentsCount}
          />
        </motion.div>
      </div>

      {/* Manual payment modal - lazy loaded on demand */}
      {showManualPaymentModal && (
        <ManualPaymentModal
          open={showManualPaymentModal}
          onOpenChange={setShowManualPaymentModal}
          onSuccess={() => {
            // L'action ne revalide que /admin/transactions et /admin/utilisateurs :
            // on rafraîchit explicitement le dashboard (plus de réactivité Convex).
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
