import { render } from "@testing-library/react"
import { usePathname, useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OnboardingGuard } from "@/components/shared/onboarding-guard"
import { mockRouter } from "../helpers/mocks"

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}))

describe("OnboardingGuard", () => {
  const mockReplace = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue(mockRouter({ replace: mockReplace }))
  })

  it("redirige vers l'onboarding si l'utilisateur n'a pas de username", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<OnboardingGuard hasUsername={false} />)

    expect(mockReplace).toHaveBeenCalledWith("/tableau-de-bord/bienvenue")
  })

  it("ne redirige pas un utilisateur sans username déjà sur l'onboarding", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord/bienvenue")

    render(<OnboardingGuard hasUsername={false} />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("redirige vers le dashboard si l'utilisateur a un username et est sur l'onboarding", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord/bienvenue")

    render(<OnboardingGuard hasUsername />)

    expect(mockReplace).toHaveBeenCalledWith("/tableau-de-bord")
  })

  it("ne fait rien si l'utilisateur a un username et est sur le dashboard", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<OnboardingGuard hasUsername />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("ne redirige pas si l'utilisateur a un username et est sur une autre page", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord/entrainement")

    render(<OnboardingGuard hasUsername />)

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
