import { useEffect, useState } from "react"
import { loadMarketingStats } from "@/features/marketing/actions"
import type { MarketingStats } from "@/features/marketing/dal"

/**
 * Stats marketing publiques via Server Action (remplace `useQuery` Convex).
 * Conserve la forme `{ stats, isLoading }` ; `setStats` dans `.then` (async) →
 * hors du piège `react-hooks/set-state-in-effect`.
 */
export function useMarketingStats() {
  const [stats, setStats] = useState<MarketingStats | undefined>(undefined)

  useEffect(() => {
    let active = true
    loadMarketingStats().then((s) => {
      if (active) setStats(s)
    })
    return () => {
      active = false
    }
  }, [])

  return { stats, isLoading: stats === undefined }
}
