"use client"

import { ArrowLeft, House, User } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

export default function DashboardError({
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
      icon={User}
      title="Erreur dans le tableau de bord"
      description="Une erreur s'est produite lors du chargement de votre tableau de bord. Veuillez réessayer ou retourner à l'accueil."
      links={[
        { label: "Tableau de bord", href: "/tableau-de-bord", icon: ArrowLeft },
        { label: "Accueil", href: "/", icon: House },
      ]}
      footnote="Si cette erreur persiste, essayez de vous déconnecter et de vous reconnecter."
    />
  )
}
