import {
  getDashboardTrends,
  getFailedPaymentsCount,
  getRecentActivity,
} from "@/features/analytics/dal"
import {
  getExpiringAccess,
  getRevenueByDay,
  getTransactionStats,
} from "@/features/payments/dal"
import { getQuestionStats } from "@/features/questions/dal"
import { getAdminStats } from "@/features/users/dal"
import { AdminDashboardClient } from "./_components/admin-dashboard-client"

export default async function AdminDashboardPage() {
  const [
    adminStats,
    questionStats,
    transactionStats,
    revenueByDay,
    expiringAccess,
    recentActivity,
    dashboardTrends,
    failedPaymentsCount,
  ] = await Promise.all([
    getAdminStats(),
    getQuestionStats(),
    getTransactionStats(),
    getRevenueByDay(),
    getExpiringAccess(),
    getRecentActivity(),
    getDashboardTrends(),
    getFailedPaymentsCount(),
  ])

  return (
    <AdminDashboardClient
      adminStats={adminStats}
      questionStats={questionStats}
      transactionStats={transactionStats}
      revenueByDay={revenueByDay}
      expiringAccess={expiringAccess}
      recentActivity={recentActivity}
      dashboardTrends={dashboardTrends}
      failedPaymentsCount={failedPaymentsCount}
    />
  )
}
