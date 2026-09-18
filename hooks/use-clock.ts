import { useEffect, useState } from "react"

/**
 * Horloge d'une surface rendue côté serveur : ancrée sur `initialNow` au
 * premier rendu (SSR et hydratation identiques), puis rafraîchie à intervalle
 * régulier depuis l'horloge locale. Voir `.claude/rules/loading-ui.md`.
 */
export function useClock(initialNow: number, intervalMs = 60_000): number {
  const [now, setNow] = useState(initialNow)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
