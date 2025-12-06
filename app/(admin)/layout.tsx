"use client"

import AdminProtection from "@/components/admin-protection"
import { DashboardShell } from "@/components/shared/dashboard-shell"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminProtection>
      <DashboardShell variant="admin">{children}</DashboardShell>
    </AdminProtection>
  )
}
