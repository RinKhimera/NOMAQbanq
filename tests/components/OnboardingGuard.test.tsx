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
    vi.mocked(useRouter).mockReturnValue(mockRouter({ replace: mockReplace }))
  })

  it.each([
    ["/tableau-de-bord", false, "/tableau-de-bord/bienvenue"],
    ["/tableau-de-bord/bienvenue", false, null],
    ["/tableau-de-bord/bienvenue", true, "/tableau-de-bord"],
    ["/tableau-de-bord", true, null],
    ["/tableau-de-bord/entrainement", true, null],
  ])(
    "sur %s, username renseigné = %s → redirection vers %s",
    (pathname, hasUsername, target) => {
      vi.mocked(usePathname).mockReturnValue(pathname)

      render(<OnboardingGuard hasUsername={hasUsername} />)

      expect(mockReplace.mock.calls).toEqual(target ? [[target]] : [])
    },
  )
})
