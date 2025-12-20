import { renderHook } from "@testing-library/react"
import { useConvexAuth, useQuery } from "convex/react"
import { describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "@/hooks/useCurrentUser"

// Mock convex/react
vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(),
  useQuery: vi.fn(),
}))

describe("useCurrentUser", () => {
  it("retourne l'état initial (chargement auth)", () => {
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.currentUser).toBeUndefined()
  })

  it("retourne non authentifié si l'auth est terminée et non connectée", () => {
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.currentUser).toBeUndefined()
  })

  it("retourne en chargement si authentifié mais utilisateur non encore récupéré", () => {
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.currentUser).toBeUndefined()
  })

  it("retourne l'utilisateur si authentifié et récupéré", () => {
    const mockUser = { _id: "user123", name: "Test User" }
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    })
    vi.mocked(useQuery).mockReturnValue(mockUser)

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.currentUser).toEqual(mockUser)
  })
})
