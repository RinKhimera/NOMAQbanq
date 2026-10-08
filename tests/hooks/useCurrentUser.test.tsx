import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { authClient } from "@/lib/auth-client"
import { CDN_HOST } from "@/lib/cdn"
import { createMockBetterAuthUser, mockAuthSession } from "../helpers/mocks"

// Mock le client Better Auth : `useCurrentUser` n'est qu'un wrapper autour de
// `authClient.useSession()`.
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}))

const mockedUseSession = vi.mocked(authClient.useSession)

describe("useCurrentUser", () => {
  describe("États de base", () => {
    it("retourne l'état de chargement quand la session est en attente", () => {
      mockedUseSession.mockReturnValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAuthSession({ isPending: true }) as any,
      )

      const { result } = renderHook(() => useCurrentUser())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.currentUser).toBeNull()
    })

    it("retourne non authentifié quand il n'y a pas de session", () => {
      mockedUseSession.mockReturnValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAuthSession({ data: null, isPending: false }) as any,
      )

      const { result } = renderHook(() => useCurrentUser())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.currentUser).toBeNull()
    })

    it("retourne l'utilisateur quand la session est active", () => {
      const user = createMockBetterAuthUser({
        name: "Jean Dupont",
        email: "jean@example.com",
      })
      mockedUseSession.mockReturnValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAuthSession({ data: { user }, isPending: false }) as any,
      )

      const { result } = renderHook(() => useCurrentUser())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.currentUser).toEqual(user)
    })
  })

  it("résout une clé de stockage d'avatar en URL CDN", () => {
    const user = createMockBetterAuthUser({ image: "avatars/u/1.jpg" })
    mockedUseSession.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuthSession({ data: { user }, isPending: false }) as any,
    )

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current.currentUser).toEqual({
      ...user,
      image: `https://${CDN_HOST}/avatars/u/1.jpg`,
    })
  })
})
