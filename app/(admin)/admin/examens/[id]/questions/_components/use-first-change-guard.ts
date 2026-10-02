"use client"

import { useState } from "react"

/**
 * Confirmation avant la première modification du jeu d'un examen finalisé :
 * la modification le remet en préparation. Une fois acceptée, la page ne
 * redemande plus. `guard(run)` exécute `run` tout de suite quand aucune
 * confirmation n'est due, sinon ouvre le dialogue et l'exécute à l'acceptation.
 */
export const useFirstChangeGuard = (needed: boolean) => {
  const [accepted, setAccepted] = useState(false)
  const [pending, setPending] = useState<(() => unknown) | null>(null)

  const guard = (run: () => unknown) => {
    if (!needed || accepted) {
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
        setAccepted(true)
        await pending?.()
      },
    },
  }
}
