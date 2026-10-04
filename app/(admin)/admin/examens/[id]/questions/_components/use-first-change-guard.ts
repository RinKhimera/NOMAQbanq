"use client"

import { useState } from "react"

/**
 * Confirmation avant de modifier le jeu d'un examen finalisé : la modification
 * le remet en préparation. `needed` vient du serveur : une écriture réussie
 * rend l'examen non finalisé et la confirmation n'est plus due ; une écriture
 * refusée le laisse finalisé et la redemande. `guard(run)` exécute `run` tout
 * de suite quand aucune confirmation n'est due, sinon ouvre le dialogue et
 * l'exécute à l'acceptation.
 */
export const useFirstChangeGuard = (needed: boolean) => {
  const [pending, setPending] = useState<(() => unknown) | null>(null)

  const guard = (run: () => unknown) => {
    if (!needed) {
      run()
      return
    }
    setPending(() => run)
  }

  return {
    guard,
    dialog: {
      open: pending !== null,
      onOpenChange: (open: boolean) => {
        if (!open) setPending(null)
      },
      onConfirm: async () => {
        await pending?.()
      },
    },
  }
}
