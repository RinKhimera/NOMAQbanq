"use client"

import { ArrowLeft, WifiOff } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

export default function ExamenBlancError({
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
      icon={WifiOff}
      title="Impossible de charger les examens"
      description="Vérifiez votre connexion internet, puis réessayez. Une participation en cours n'est pas perdue."
      links={[
        { label: "Tableau de bord", href: "/tableau-de-bord", icon: ArrowLeft },
      ]}
    />
  )
}
