import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import OnboardingPage from "@/app/(dashboard)/dashboard/onboarding/page"
import { updateProfile } from "@/features/users/actions"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { createMockBetterAuthUser, mockRouter } from "../helpers/mocks"

vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/features/users/actions", () => ({ updateProfile: vi.fn() }))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("OnboardingPage", () => {
  const mockReplace = vi.fn()
  const mockRefetch = vi.fn()

  const setUser = (username: string | null) =>
    vi.mocked(useCurrentUser).mockImplementation(
      () =>
        ({
          currentUser: createMockBetterAuthUser({
            username,
            name: "N.M.Y",
            bio: null,
          }),
          isLoading: false,
          isAuthenticated: true,
          refetch: mockRefetch,
        }) as unknown as ReturnType<typeof useCurrentUser>,
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mockRefetch.mockResolvedValue(undefined)
    vi.mocked(useRouter).mockReturnValue(mockRouter({ replace: mockReplace }))
    setUser(null)
  })

  it("laisse saisir le username sans l'effacer (pas de boucle de reset)", () => {
    render(<OnboardingPage />)

    const username = screen.getByPlaceholderText(
      "votre_nom_utilisateur",
    ) as HTMLInputElement
    fireEvent.change(username, { target: { value: "youssouf123" } })

    expect(username.value).toBe("youssouf123")
  })

  it("resynchronise la session puis redirige après soumission réussie", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ success: true })

    render(<OnboardingPage />)

    fireEvent.change(screen.getByPlaceholderText("Ex: Marie Dupont"), {
      target: { value: "Youssouf N" },
    })
    fireEvent.change(screen.getByPlaceholderText("votre_nom_utilisateur"), {
      target: { value: "youssouf123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /terminer/i }))

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ username: "youssouf123" }),
      ),
    )

    await waitFor(() =>
      expect(mockRefetch).toHaveBeenCalledWith({
        query: { disableCookieCache: true },
      }),
    )
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"))
    expect(mockRefetch.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0],
    )
  })

  it("ne navigue pas si la soumission échoue", async () => {
    vi.mocked(updateProfile).mockResolvedValue({
      success: false,
      error: "Ce nom d'utilisateur est déjà pris !",
    })

    render(<OnboardingPage />)

    fireEvent.change(screen.getByPlaceholderText("Ex: Marie Dupont"), {
      target: { value: "Youssouf N" },
    })
    fireEvent.change(screen.getByPlaceholderText("votre_nom_utilisateur"), {
      target: { value: "youssouf123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /terminer/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(mockRefetch).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("redirige vers le dashboard si l'utilisateur a déjà un username", async () => {
    setUser("deja_pris")

    render(<OnboardingPage />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"))
  })
})
