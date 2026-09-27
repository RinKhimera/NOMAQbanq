import { useEffect, useState } from "react"
import { loadTransactionAccessImpact } from "@/features/payments/actions"
import type { AccessImpact } from "@/features/payments/dal"
import { affectedAccesses } from "./access-impact"

export type AccessImpactState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; affected: AccessImpact[]; loadedAt: number }

type Loaded = {
  transactionId: string
  /** null = chargement en échec. */
  impacts: AccessImpact[] | null
  loadedAt: number
}

/**
 * Aperçu d'impact d'une transaction, chargé à l'ouverture de la modale. Tant
 * qu'il n'est pas arrivé pour CETTE transaction, l'état est `loading` : ni
 * « non affecté », ni la réponse d'une transaction ouverte juste avant.
 */
export const useAccessImpact = (
  transactionId: string | null,
  open: boolean,
): AccessImpactState => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!transactionId || !open) return
    let current = true
    loadTransactionAccessImpact(transactionId)
      .then((impacts) => {
        if (current)
          setLoaded({
            transactionId,
            impacts: impacts ?? [],
            loadedAt: Date.now(),
          })
      })
      .catch(() => {
        if (current)
          setLoaded({ transactionId, impacts: null, loadedAt: Date.now() })
      })
    return () => {
      current = false
    }
  }, [transactionId, open])

  if (!loaded || loaded.transactionId !== transactionId)
    return { status: "loading" }
  if (loaded.impacts === null) return { status: "failed" }
  return {
    status: "ready",
    affected: affectedAccesses(loaded.impacts, loaded.loadedAt),
    loadedAt: loaded.loadedAt,
  }
}
