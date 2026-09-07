"use client"

import { useLinkStatus } from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type LinkPendingIndicatorProps = {
  className?: string
}

// À rendre DANS un `<Link prefetch={false}>` : sans prefetch, le squelette
// `loading.tsx` de la cible n'arrive qu'avec la réponse du serveur (layout →
// session → Neon), et le clic resterait sans retour visuel d'ici là. Apparition
// différée pour ne pas clignoter sur une navigation rapide.
export const LinkPendingIndicator = ({
  className,
}: LinkPendingIndicatorProps) => {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      className={cn(
        "animate-in fade-in fill-mode-both delay-150 duration-200",
        className,
      )}
    >
      <Spinner size="sm" label="Ouverture de la page…" />
    </span>
  )
}
