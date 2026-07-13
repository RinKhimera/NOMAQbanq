import { useEffect, useState } from "react"
import { loadMarketingStats } from "@/features/marketing/actions"
import type { MarketingStats } from "@/features/marketing/dal"

/**
 * Stats marketing publiques via Server Action.
 * Conserve la forme `{ stats, isLoading }` ; `setStats` dans `.then` (async) →
 * hors du piège `react-hooks/set-state-in-effect`.
 * `null` = échec de chargement : sort du skeleton, les consommateurs retombent
 * sur leurs fallbacks inline (`stats?.x ?? "…"`).
 */
export function useMarketingStats() {
  const [stats, setStats] = useState<MarketingStats | null | undefined>(
    undefined,
  )

  useEffect(() => {
    let active = true
    loadMarketingStats()
      .then((s) => {
        if (active) setStats(s)
      })
      .catch(() => {
        if (active) setStats(null)
      })
    return () => {
      active = false
    }
  }, [])

  return { stats: stats ?? undefined, isLoading: stats === undefined }
}
