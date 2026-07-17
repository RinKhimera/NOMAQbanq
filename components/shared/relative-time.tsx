"use client"

import { useEffect, useState } from "react"
import { formatTimeRemaining } from "@/lib/format"

const REFRESH_MS = 60_000

/**
 * Temps relatif hydration-safe. Un texte relatif SSR (« il y a 2 minutes »)
 * peut différer d'une minute au moment de l'hydratation → mismatch React et
 * régénération de l'arbre. `suppressHydrationWarning` absorbe cet écart bénin
 * sur le span uniquement, et le tick périodique garde le texte vivant côté
 * client (l'écart éventuel se corrige au plus tard au tick suivant).
 */
export function RelativeTime({ timestamp }: { timestamp: number }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  return <span suppressHydrationWarning>{formatTimeRemaining(timestamp)}</span>
}
