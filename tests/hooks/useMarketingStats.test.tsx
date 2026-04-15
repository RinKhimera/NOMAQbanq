import { renderHook } from "@testing-library/react"
import { useQuery } from "convex/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useMarketingStats } from "@/hooks/useMarketingStats"

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}))

// Mock api pour vérifier les appels
vi.mock("@/convex/_generated/api", () => ({
  api: {
    marketing: {
      getMarketingStats: "getMarketingStats",
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useMarketingStats", () => {
  it("retourne isLoading=true tant que la query n'a pas répondu", () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useMarketingStats())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.stats).toBeUndefined()
  })

  it("retourne les stats et isLoading=false quand la query répond", () => {
    const mockStats = {
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
    vi.mocked(useQuery).mockReturnValue(mockStats)

    const { result } = renderHook(() => useMarketingStats())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.stats).toEqual(mockStats)
  })

  it("ne skip jamais la query (stats publiques, pas d'auth requise)", () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    renderHook(() => useMarketingStats())

    // useQuery appelé sans argument "skip" → la query part toujours
    expect(useQuery).toHaveBeenCalledWith("getMarketingStats")
  })
})
