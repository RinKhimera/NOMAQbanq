import { requireSession } from "@/lib/auth-guards"

// Passation plein écran (série d'entraînement, examen blanc) : hors de la
// coquille de l'espace étudiant, la barre de passation est la seule barre.
// Garde SERVEUR : la zone exige une session, comme le tableau de bord.
export default async function PassationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()

  return <div className="bg-background text-ink min-h-dvh">{children}</div>
}
