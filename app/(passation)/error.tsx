"use client"

import { ArrowLeft, BookOpen, ClipboardList } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

// Frontière d'erreur de la zone plein écran : hors de la coquille étudiant,
// sans elle une erreur de rendu tomberait sur la page d'erreur racine.
export default function PassationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Impossible de charger la passation"
      description="Vérifiez votre connexion internet, puis réessayez. Une série ou une participation en cours n'est pas perdue."
      links={[
        { label: "Tableau de bord", href: "/tableau-de-bord", icon: ArrowLeft },
        {
          label: "Entraînement",
          href: "/tableau-de-bord/entrainement",
          icon: BookOpen,
        },
        {
          label: "Examens blancs",
          href: "/tableau-de-bord/examen-blanc",
          icon: ClipboardList,
        },
      ]}
    />
  )
}
