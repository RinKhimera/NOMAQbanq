import { getExamsWithParticipation } from "@/features/exams/dal"
import { hasAccess } from "@/features/payments/dal"
import { getCurrentSession } from "@/lib/dal"
import { ExamenBlancClient } from "./_components/examen-blanc-client"

// Hors composant : isole l'horloge (impure) du corps de rendu (react-hooks/purity).
const currentTimeMs = () => Date.now()

export default async function ExamenBlancPage() {
  const session = await getCurrentSession()
  const isAdmin = session?.user?.role === "admin"

  const exams = await getExamsWithParticipation()
  // Éligibilité = accès examen actif (bypass admin). Court-circuit pour éviter
  // l'appel `hasAccess` inutile côté admin.
  const isEligible = isAdmin || (await hasAccess("exam"))

  return (
    <ExamenBlancClient
      exams={exams}
      isEligible={isEligible}
      initialNow={currentTimeMs()}
    />
  )
}
