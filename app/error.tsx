"use client"

import { House, TriangleAlert } from "lucide-react"
import { RouteError } from "@/components/shared/route-error"

export default function Error({
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
      icon={TriangleAlert}
      title="Oups ! Une erreur s'est produite"
      description="Nous nous excusons pour ce désagrément. Une erreur inattendue s'est produite."
      links={[{ label: "Accueil", href: "/", icon: House }]}
      footnote="Si le problème persiste, veuillez contacter le support technique."
    />
  )
}
