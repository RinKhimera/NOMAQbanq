import { renderHook } from "@testing-library/react"
import { useConvexAuth, useQuery } from "convex/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { api } from "@/convex/_generated/api"

// Mock convex/react
vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(),
  useQuery: vi.fn(),
}))

// Mock api pour vérifier les appels
vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      getCurrentUser: "getCurrentUser",
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useCurrentUser", () => {
  describe("États de base", () => {
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

  describe("Comportement skip query", () => {
    it("utilise 'skip' quand non authentifié pour éviter erreur auth", () => {
      vi.mocked(useConvexAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })
      vi.mocked(useQuery).mockReturnValue(undefined)

      renderHook(() => useCurrentUser())

      // Vérifier que useQuery est appelé avec "skip"
      expect(useQuery).toHaveBeenCalledWith(api.users.getCurrentUser, "skip")
    })

    it("n'utilise pas 'skip' quand authentifié", () => {
      vi.mocked(useConvexAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })
      vi.mocked(useQuery).mockReturnValue(undefined)

      renderHook(() => useCurrentUser())

      // Vérifier que useQuery est appelé avec undefined (pas skip)
      expect(useQuery).toHaveBeenCalledWith(api.users.getCurrentUser, undefined)
    })

    it("utilise 'skip' pendant le chargement auth", () => {
      vi.mocked(useConvexAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      })
      vi.mocked(useQuery).mockReturnValue(undefined)

      renderHook(() => useCurrentUser())

      // Pendant le chargement, isAuthenticated est false donc skip
      expect(useQuery).toHaveBeenCalledWith(api.users.getCurrentUser, "skip")
    })
  })

  describe("Données utilisateur", () => {
    it("retourne null si l'utilisateur n'existe pas en base", () => {
      vi.mocked(useConvexAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })
      // null signifie que la query a retourné mais aucun utilisateur trouvé
      vi.mocked(useQuery).mockReturnValue(null)

      const { result } = renderHook(() => useCurrentUser())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.currentUser).toBeNull()
    })

    it("retourne les données utilisateur complètes", () => {
      const mockUser = {
        _id: "user123",
        _creationTime: Date.now(),
        name: "Jean Dupont",
        email: "jean@example.com",
        role: "user" as const,
        image: "https://example.com/avatar.png",
      }
      vi.mocked(useConvexAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })
      vi.mocked(useQuery).mockReturnValue(mockUser)

      const { result } = renderHook(() => useCurrentUser())

      expect(result.current.currentUser).toEqual(mockUser)
      expect(result.current.currentUser?.name).toBe("Jean Dupont")
      expect(result.current.currentUser?.email).toBe("jean@example.com")
    })
  })
})
