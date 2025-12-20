import { render } from "@testing-library/react"
import { usePathname, useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { Doc } from "@/convex/_generated/dataModel"
import { useCurrentUser } from "@/hooks/useCurrentUser"

// Mock hooks
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}))

describe("OnboardingGuard", () => {
  const mockReplace = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({
      replace: mockReplace,
    } as unknown as ReturnType<typeof useRouter>)
  })

  it("ne fait rien si le chargement est en cours", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      currentUser: null,
      isLoading: true,
      isAuthenticated: false,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(<OnboardingGuard />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("ne fait rien si l'utilisateur n'est pas connecté", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      currentUser: null,
      isLoading: false,
      isAuthenticated: false,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(<OnboardingGuard />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("redirige vers onboarding si l'utilisateur n'a pas de username", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      currentUser: { username: undefined } as unknown as Doc<"users">,
      isLoading: false,
      isAuthenticated: true,
    } as unknown as ReturnType<typeof useCurrentUser>)
    vi.mocked(usePathname).mockReturnValue("/dashboard")

    render(<OnboardingGuard />)

    expect(mockReplace).toHaveBeenCalledWith("/dashboard/onboarding")
  })

  it("redirige vers dashboard si l'utilisateur a un username et est sur la page onboarding", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      currentUser: { username: "testuser" } as unknown as Doc<"users">,
      isLoading: false,
      isAuthenticated: true,
    } as unknown as ReturnType<typeof useCurrentUser>)
    vi.mocked(usePathname).mockReturnValue("/dashboard/onboarding")

    render(<OnboardingGuard />)

    expect(mockReplace).toHaveBeenCalledWith("/dashboard")
  })

  it("ne fait rien si l'utilisateur a un username et est sur le dashboard", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      currentUser: { username: "testuser" } as unknown as Doc<"users">,
      isLoading: false,
      isAuthenticated: true,
    } as unknown as ReturnType<typeof useCurrentUser>)
    vi.mocked(usePathname).mockReturnValue("/dashboard")

    render(<OnboardingGuard />)

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
