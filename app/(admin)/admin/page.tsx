"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { motion } from "motion/react"
import { IconLayoutDashboard } from "@tabler/icons-react"
import { api } from "@/convex/_generated/api"
import {
  AdminDashboardSkeleton,
  AdminVitalCards,
  RevenueChart,
  DomainChart,
  ActivityFeed,
  QuickActions,
  AlertsPanel,
} from "@/components/admin/dashboard"
import { ManualPaymentModal } from "@/components/shared/payments"

export default function AdminDashboardPage() {
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false)

  // Fetch all dashboard data in parallel
  const adminStats = useQuery(api.users.getAdminStats)
  const questionStats = useQuery(api.questions.getQuestionStats)
  const transactionStats = useQuery(api.payments.getTransactionStats)
  const revenueByDay = useQuery(api.payments.getRevenueByDay, {})
  const expiringAccess = useQuery(api.payments.getExpiringAccess)
  const recentActivity = useQuery(api.analytics.getRecentActivity)
  const dashboardTrends = useQuery(api.analytics.getDashboardTrends)
  const failedPaymentsCount = useQuery(api.analytics.getFailedPaymentsCount)

  // Show skeleton while loading critical data
  const isLoading =
    adminStats === undefined ||
    questionStats === undefined ||
    transactionStats === undefined

  if (isLoading) {
    return <AdminDashboardSkeleton />
  }

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr })

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 lg:px-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <IconLayoutDashboard className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Tableau de bord
            </h1>
            <p className="text-muted-foreground text-sm capitalize">{today}</p>
          </div>
        </div>
      </motion.div>

      {/* Vital cards */}
      <AdminVitalCards
        revenueData={{
          total: transactionStats.recentRevenue,
          trend: dashboardTrends?.revenueTrend ?? 0,
        }}
        usersData={{
          total: adminStats.totalUsers,
          trend: dashboardTrends?.usersTrend ?? 0,
        }}
        activeExams={adminStats.activeExams}
        expiringAccessCount={expiringAccess?.length ?? 0}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <RevenueChart data={revenueByDay ?? []} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <ActivityFeed activities={recentActivity ?? []} />
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
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
            expiringAccess={expiringAccess ?? []}
            failedPaymentsCount={failedPaymentsCount ?? 0}
          />
        </motion.div>
      </div>

      {/* Manual payment modal */}
      <ManualPaymentModal
        open={showManualPaymentModal}
        onOpenChange={setShowManualPaymentModal}
        onSuccess={() => {
          // Data will auto-refresh due to Convex reactivity
        }}
      />
    </div>
  )
}
