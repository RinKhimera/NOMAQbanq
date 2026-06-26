import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadMarketingStats } from "@/features/marketing/actions"
import type { MarketingStats } from "@/features/marketing/dal"
import { useMarketingStats } from "@/hooks/useMarketingStats"

// Le hook appelle la Server Action `loadMarketingStats` (remplace `useQuery`
// Convex depuis 5.6a). On la mocke → le module réel (qui tire le DAL + `db`)
// n'est jamais chargé en environnement happy-dom.
vi.mock("@/features/marketing/actions", () => ({
  loadMarketingStats: vi.fn(),
}))

const mockStats: MarketingStats = {
  totalQuestions: "3000+",
  totalUsers: "200+",
  totalDomains: 12,
  successRate: "85%",
  rating: "4.9/5",
  topDomains: [
    { domain: "Cardiologie", count: 500 },
    { domain: "Neurologie", count: 300 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useMarketingStats", () => {
  it("retourne isLoading=true tant que l'action n'a pas répondu", () => {
    // Promesse jamais résolue → reste en chargement.
    vi.mocked(loadMarketingStats).mockReturnValue(
      new Promise<MarketingStats>(() => {}),
    )

    const { result } = renderHook(() => useMarketingStats())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.stats).toBeUndefined()
  })

  it("retourne les stats et isLoading=false quand l'action répond", async () => {
    vi.mocked(loadMarketingStats).mockResolvedValue(mockStats)

    const { result } = renderHook(() => useMarketingStats())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.stats).toEqual(mockStats)
  })

  it("appelle l'action au montage (stats publiques, pas d'auth requise)", () => {
    vi.mocked(loadMarketingStats).mockResolvedValue(mockStats)

    renderHook(() => useMarketingStats())

    expect(loadMarketingStats).toHaveBeenCalledTimes(1)
  })
})
