import { DashboardShell } from "@/components/shared/dashboard-shell"
import { requireRole } from "@/lib/auth-guards"
import { toSessionUser } from "@/lib/session-user"

// Garde SERVEUR (la seule barrière de la zone) : redirige tout non-admin avant
// le moindre rendu. `proxy.ts` ne couvre pas cette zone.
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
