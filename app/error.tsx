"use client"

import { RotateCcw, TriangleAlert } from "lucide-react"
import { useReportRouteError } from "@/components/shared/route-error"
import { StatusCard, StatusScreen } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useReportRouteError(error)

  return (
    <StatusScreen>
      <StatusCard
        icon={TriangleAlert}
        iconTone="warning"
        label="Erreur 500"
        title="Une erreur est survenue"
        actions={
          <>
            <Button onClick={reset} className="max-md:h-11">
              <RotateCcw aria-hidden />
              Réessayer
            </Button>
            {/* Rechargement complet : l'arbre React est dans un état d'erreur. */}
            <Button asChild variant="outline" className="max-md:h-11">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/">Retour à l&apos;accueil</a>
            </Button>
          </>
        }
        help={
          <>
            Le problème persiste ? Écrivez-nous à{" "}
            <a
              href="mailto:nomaqbanq@outlook.com"
              className="focus-ring text-accent-ink rounded-sm hover:underline"
            >
              nomaqbanq@outlook.com
            </a>{" "}
            en précisant la page concernée.
          </>
        }
      >
        <p className="text-ink-2 text-[15px] leading-[1.65]">
          Un problème technique nous empêche d&apos;afficher cette page.
          L&apos;équipe a été prévenue automatiquement.
        </p>
      </StatusCard>
    </StatusScreen>
  )
}
