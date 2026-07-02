import { render } from "@testing-library/react"
import { usePathname, useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import {
  createMockBetterAuthUser,
  mockCurrentUser,
  mockRouter,
} from "../helpers/mocks"

// Mock hooks
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}))

// `mockCurrentUser` retourne une forme simplifiée ; le hook réel renvoie le type
// inféré (plus riche) de Better Auth. On cast au point d'injection du mock.
const setCurrentUser = (value: ReturnType<typeof mockCurrentUser>) =>
  vi
    .mocked(useCurrentUser)
    .mockReturnValue(value as ReturnType<typeof useCurrentUser>)

describe("OnboardingGuard", () => {
  const mockReplace = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue(mockRouter({ replace: mockReplace }))
  })

  it("ne fait rien si le chargement est en cours", () => {
    setCurrentUser(mockCurrentUser({ isLoading: true }))

    render(<OnboardingGuard />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("ne fait rien si l'utilisateur n'est pas connecté", () => {
    setCurrentUser(mockCurrentUser())

    render(<OnboardingGuard />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("redirige vers onboarding si l'utilisateur n'a pas de username", () => {
    setCurrentUser(
      mockCurrentUser({
        currentUser: createMockBetterAuthUser({ username: null }),
        isAuthenticated: true,
      }),
    )
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<OnboardingGuard />)

    expect(mockReplace).toHaveBeenCalledWith("/tableau-de-bord/bienvenue")
  })

  it("redirige vers dashboard si l'utilisateur a un username et est sur la page onboarding", () => {
    setCurrentUser(
      mockCurrentUser({
        currentUser: createMockBetterAuthUser({ username: "testuser" }),
        isAuthenticated: true,
      }),
    )
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord/bienvenue")

    render(<OnboardingGuard />)

    expect(mockReplace).toHaveBeenCalledWith("/tableau-de-bord")
  })

  it("ne fait rien si l'utilisateur a un username et est sur le dashboard", () => {
    setCurrentUser(
      mockCurrentUser({
        currentUser: createMockBetterAuthUser({ username: "testuser" }),
        isAuthenticated: true,
      }),
    )
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<OnboardingGuard />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("ne redirige pas si l'utilisateur a un username et est sur une autre page", () => {
    setCurrentUser(
      mockCurrentUser({
        currentUser: createMockBetterAuthUser({ username: "testuser" }),
        isAuthenticated: true,
      }),
    )
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord/entrainement")

    render(<OnboardingGuard />)

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
