import { DashboardShell } from "@/components/shared/dashboard-shell"
import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { requireSession } from "@/lib/auth-guards"

// Garde SERVEUR : exige une session pour toute la zone dashboard (le proxy reste optimiste).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()

  return (
    <>
      <OnboardingGuard />
      <DashboardShell variant="user">{children}</DashboardShell>
    </>
  )
}
