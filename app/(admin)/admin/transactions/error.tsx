"use client"

import { ArrowLeft } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

export default function TransactionsError({
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
      title="Impossible de charger les transactions"
      description="Vérifiez votre connexion, puis réessayez. Aucun paiement n'est perdu."
      links={[
        { label: "Retour au tableau de bord", href: "/admin", icon: ArrowLeft },
      ]}
    />
  )
}
