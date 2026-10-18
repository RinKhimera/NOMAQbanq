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
  // Le retour garde les filtres et la période du tableau d'où l'on vient.
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
