import { useEffect, useState } from "react"
import { loadTransactionAccessImpact } from "@/features/payments/actions"
import type { AccessImpact } from "@/features/payments/dal"

export type AccessImpactState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; impacts: AccessImpact[]; loadedAt: number }

type Loaded = {
  transactionId: string
  /** null = chargement en échec. */
  impacts: AccessImpact[] | null
  loadedAt: number
}

/**
 * Aperçu d'impact d'une transaction, chargé quand `enabled` passe à vrai. Tant
 * qu'il n'est pas arrivé pour CETTE transaction, l'état est `loading` : ni
 * « non affecté », ni la réponse d'une transaction ouverte juste avant.
 */
export const useAccessImpact = (
  transactionId: string | null,
  enabled: boolean,
): AccessImpactState => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!transactionId || !enabled) return
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
  }, [transactionId, enabled])

  if (!loaded || loaded.transactionId !== transactionId)
    return { status: "loading" }
  if (loaded.impacts === null) return { status: "failed" }
  return {
    status: "ready",
    impacts: loaded.impacts,
    loadedAt: loaded.loadedAt,
  }
}
