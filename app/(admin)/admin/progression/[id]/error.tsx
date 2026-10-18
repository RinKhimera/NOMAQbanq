"use client"

import { ArrowLeft } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { RouteError } from "@/components/shared/route-error"
import {
  parseProgressionList,
  progressionListHref,
} from "../_components/progression-params"

export default function AdminStudentProgressionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Filtres et période gardés ; la page de l'étudiant n'est plus connue ici.
  const list = parseProgressionList(new URLSearchParams(useSearchParams()))
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Impossible de charger la progression de l'étudiant"
      description="Vérifiez votre connexion, puis réessayez."
      links={[
        {
          label: "Retour à la liste",
          href: progressionListHref({ ...list, page: 1 }),
          icon: ArrowLeft,
        },
      ]}
    />
  )
}
