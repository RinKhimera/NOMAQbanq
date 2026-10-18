"use client"

import { ArrowLeft } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"
import { ADMIN_PROGRESSION_HREF } from "@/lib/admin-links"

export default function AdminStudentProgressionError({
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
      title="Impossible de charger la progression de l'étudiant"
      description="Vérifiez votre connexion, puis réessayez."
      links={[
        {
          label: "Retour à la liste",
          href: ADMIN_PROGRESSION_HREF,
          icon: ArrowLeft,
        },
      ]}
    />
  )
}
