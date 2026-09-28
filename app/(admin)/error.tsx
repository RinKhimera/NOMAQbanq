"use client"

import { ArrowLeft, LayoutDashboard, Settings } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

export default function AdminError({
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
      icon={Settings}
      title="Erreur dans le panneau d'administration"
      description="Une erreur s'est produite dans le panneau d'administration. Veuillez réessayer ou retourner au tableau de bord principal."
      links={[
        { label: "Retour Admin", href: "/admin", icon: ArrowLeft },
        {
          label: "Tableau de bord utilisateur",
          href: "/tableau-de-bord",
          icon: LayoutDashboard,
        },
      ]}
      footnote="Si cette erreur persiste, vérifiez vos permissions d'administrateur."
    />
  )
}
