import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ProfileAccountSection } from "@/components/shared/profile/profile-account-section"
import { authClient } from "@/lib/auth-client"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/users/actions", () => ({ setAccountPassword: vi.fn() }))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: vi.fn(),
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
}))

const methods = {
  hasPassword: true,
  emailVerified: true,
  google: { linked: false as const },
}

describe("ProfileAccountSection", () => {
  it("après un changement réussi, le focus revient au bouton « Modifier »", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({
      error: null,
    } as never)
    render(
      <ProfileAccountSection
        methods={methods as never}
        email="amina@exemple.ca"
        googleEnabled={false}
        profilePath="/tableau-de-bord/profil"
      />,
    )
    const toggle = screen.getByTestId("login-method-change-password")
    await userEvent.click(toggle)
    await userEvent.type(
      screen.getByTestId("security-current-password"),
      "AncienPassw0rd!",
    )
    await userEvent.type(
      screen.getByTestId("security-new-password"),
      "NouveauPassw0rd!",
    )
    await userEvent.type(
      screen.getByTestId("security-confirm-password"),
      "NouveauPassw0rd!",
    )
    await userEvent.click(screen.getByTestId("security-submit"))
    await waitFor(() =>
      expect(screen.queryByTestId("security-submit")).not.toBeInTheDocument(),
    )
    expect(toggle).toHaveFocus()
  })
})
