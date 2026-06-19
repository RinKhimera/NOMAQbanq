import { DashboardShell } from "@/components/shared/dashboard-shell"
import { requireRole } from "@/lib/auth-guards"

// Garde SERVEUR (la vraie barrière) : redirige tout non-admin avant le moindre rendu.
// Le proxy.ts ne fait qu'un check optimiste de cookie ; l'autorisation fait foi ICI.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["admin"])

  return <DashboardShell variant="admin">{children}</DashboardShell>
}
