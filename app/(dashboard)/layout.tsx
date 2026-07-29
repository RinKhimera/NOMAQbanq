import { DashboardShell } from "@/components/shared/dashboard-shell"
import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { requireSession } from "@/lib/auth-guards"
import { toSessionUser } from "@/lib/session-user"

// Garde SERVEUR : exige une session pour toute la zone dashboard (le proxy reste optimiste).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  return (
    <>
      <OnboardingGuard />
      <DashboardShell variant="user" user={toSessionUser(session)}>
        {children}
      </DashboardShell>
    </>
  )
}
