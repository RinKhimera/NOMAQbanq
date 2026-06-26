import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { authClient } from "@/lib/auth-client"
import { createMockBetterAuthUser, mockAuthSession } from "../helpers/mocks"

// Mock le client Better Auth : `useCurrentUser` est désormais un simple wrapper
// autour de `authClient.useSession()`.
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}))

const mockedUseSession = vi.mocked(authClient.useSession)

beforeEach(() => {
  vi.clearAllMocks()
})

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

  describe("Données utilisateur", () => {
    it("mappe correctement les champs de l'utilisateur", () => {
      const user = createMockBetterAuthUser({
        name: "Jean Dupont",
        email: "jean@example.com",
        role: "admin",
        username: "jeand",
      })
      mockedUseSession.mockReturnValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAuthSession({ data: { user }, isPending: false }) as any,
      )

      const { result } = renderHook(() => useCurrentUser())

      expect(result.current.currentUser?.name).toBe("Jean Dupont")
      expect(result.current.currentUser?.email).toBe("jean@example.com")
      expect(result.current.currentUser?.role).toBe("admin")
      expect(result.current.currentUser?.username).toBe("jeand")
    })
  })
})
