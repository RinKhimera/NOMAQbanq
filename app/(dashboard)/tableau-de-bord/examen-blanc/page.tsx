import type { Metadata } from "next"
import { getExamsWithParticipation } from "@/features/exams/dal"
import { hasAccess } from "@/features/payments/dal"
import { getCurrentSession } from "@/lib/dal"
import { ExamenBlancClient } from "./_components/examen-blanc-client"

// Hors composant : isole l'horloge (impure) du corps de rendu (react-hooks/purity).
const currentTimeMs = () => Date.now()

export const metadata: Metadata = { title: "Examens blancs" }

export default async function ExamenBlancPage() {
  const session = await getCurrentSession()
  const isAdmin = session?.user?.role === "admin"

  const exams = await getExamsWithParticipation()
  // Accès aux examens `subscribers` = abonnement actif (bypass admin). Court-circuit
  // pour éviter l'appel `hasAccess` inutile côté admin. L'éligibilité par-examen
  // (un examen `restricted` présent dans la liste = membre → éligible sans abo) est
  // calculée côté client à partir de `hasExamAccess` + `audienceType`.
  const hasExamAccess = isAdmin || (await hasAccess("exam"))

  return (
    <ExamenBlancClient
      exams={exams}
      hasExamAccess={hasExamAccess}
      initialNow={currentTimeMs()}
    />
  )
}
