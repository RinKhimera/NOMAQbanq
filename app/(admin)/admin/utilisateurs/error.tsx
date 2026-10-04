"use client"

import { ArrowLeft } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

export default function UsersError({
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
      title="Impossible de charger les utilisateurs"
      description="Vérifiez votre connexion, puis réessayez."
      links={[
        { label: "Retour au tableau de bord", href: "/admin", icon: ArrowLeft },
      ]}
    />
  )
}
