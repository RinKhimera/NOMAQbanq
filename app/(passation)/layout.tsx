import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { requireSession } from "@/lib/auth-guards"

// Passation plein écran (série d'entraînement, examen blanc) : hors de la
// coquille de l'espace étudiant, la barre de passation est la seule barre.
// Garde SERVEUR : la zone exige une session, comme le tableau de bord.
export default async function PassationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  return (
    <>
      <OnboardingGuard hasUsername={!!session.user.username} />
      <div className="bg-background text-ink min-h-dvh">{children}</div>
    </>
  )
}
