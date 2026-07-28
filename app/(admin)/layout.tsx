import { DashboardShell } from "@/components/shared/dashboard-shell"
import { requireRole } from "@/lib/auth-guards"
import { toSessionUser } from "@/lib/session-user"

// Garde SERVEUR (la vraie barrière) : redirige tout non-admin avant le moindre rendu.
// Le proxy.ts ne fait qu'un check optimiste de cookie ; l'autorisation fait foi ICI.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireRole(["admin"])

  return (
    <DashboardShell variant="admin" user={toSessionUser(session)}>
      {children}
    </DashboardShell>
  )
}
