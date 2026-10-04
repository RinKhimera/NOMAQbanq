import { AdminShell } from "@/components/shared/shell/admin-shell"
import { requireRole } from "@/lib/auth-guards"
import { deploymentEnvLabel } from "@/lib/deployment-env"
import { env } from "@/lib/env/server"
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
    <AdminShell
      user={toSessionUser(session)}
      envLabel={deploymentEnvLabel(env.VERCEL_ENV)}
    >
      {children}
    </AdminShell>
  )
}
