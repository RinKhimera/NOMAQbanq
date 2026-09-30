import { getDashboardTrends, getRecentActivity } from "@/features/analytics/dal"
import {
  getAvailableProducts,
  getExpiringAccess,
  getFailedClientsCount,
  getRevenueByDay,
  getTransactionStats,
} from "@/features/payments/dal"
import { getQuestionStats } from "@/features/questions/dal"
import { getAdminStats } from "@/features/users/dal"
import { currentTimeMs } from "@/lib/clock"
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
    failedClientsCount,
    products,
  ] = await Promise.all([
    getAdminStats(),
    getQuestionStats(),
    getTransactionStats(),
    getRevenueByDay(),
    getExpiringAccess(),
    getRecentActivity(),
    getDashboardTrends(),
    getFailedClientsCount(),
    getAvailableProducts(),
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
      failedClientsCount={failedClientsCount}
      products={products}
      initialNow={currentTimeMs()}
    />
  )
}
