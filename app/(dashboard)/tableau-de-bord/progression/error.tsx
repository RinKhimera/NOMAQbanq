"use client"

import { ArrowLeft, WifiOff } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

export default function ProgressionError({
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
      title="Impossible de charger votre progression"
      description="Vérifiez votre connexion internet, puis réessayez. Vos résultats ne sont pas perdus."
      links={[
        { label: "Tableau de bord", href: "/tableau-de-bord", icon: ArrowLeft },
      ]}
    />
  )
}
