import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { StudentShell } from "@/components/shared/shell/student-shell"
import { getMyAccess } from "@/features/payments/dal"
import { requireSession } from "@/lib/auth-guards"
import { toSessionUser } from "@/lib/session-user"

// Garde SERVEUR : exige une session pour toute la zone dashboard (le proxy reste optimiste).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()
  const user = toSessionUser(session)
  const access = user.role === "admin" ? null : await getMyAccess()

  return (
    <>
      <OnboardingGuard hasUsername={!!session.user.username} />
      <StudentShell user={user} access={access}>
        {children}
      </StudentShell>
    </>
  )
}
