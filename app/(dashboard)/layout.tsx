import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { StudentShell } from "@/components/shared/shell/student-shell"
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
      <OnboardingGuard hasUsername={!!session.user.username} />
      <StudentShell user={toSessionUser(session)}>{children}</StudentShell>
    </>
  )
}
