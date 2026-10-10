import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ProfileAccountSection } from "@/components/shared/profile/profile-account-section"
import { setAccountPassword } from "@/features/users/actions"
import { authClient } from "@/lib/auth-client"

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}))
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

const props = {
  email: "amina@exemple.ca",
  googleEnabled: false,
  profilePath: "/tableau-de-bord/profil",
}

const setPassword = async () => {
  await userEvent.click(screen.getByTestId("login-method-set-password"))
  await userEvent.click(screen.getByTestId("set-new-password"))
  await userEvent.paste("NouveauPassw0rd!")
  await userEvent.click(screen.getByTestId("set-confirm-password"))
  await userEvent.paste("NouveauPassw0rd!")
  await userEvent.click(screen.getByTestId("set-password-submit"))
}

describe("ProfileAccountSection", () => {
  it("après un changement réussi, le focus revient au bouton « Modifier »", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({
      error: null,
    } as never)
    render(<ProfileAccountSection methods={methods as never} {...props} />)
    const toggle = screen.getByTestId("login-method-change-password")
    await userEvent.click(toggle)
    await userEvent.click(screen.getByTestId("security-current-password"))
    await userEvent.paste("AncienPassw0rd!")
    await userEvent.click(screen.getByTestId("security-new-password"))
    await userEvent.paste("NouveauPassw0rd!")
    await userEvent.click(screen.getByTestId("security-confirm-password"))
    await userEvent.paste("NouveauPassw0rd!")
    await userEvent.click(screen.getByTestId("security-submit"))
    await waitFor(() =>
      expect(screen.queryByTestId("security-submit")).not.toBeInTheDocument(),
    )
    expect(toggle).toHaveFocus()
  })

  it("après un mot de passe défini, referme le formulaire sans recharger la page", async () => {
    const reload = vi.fn()
    vi.stubGlobal("location", { ...location, reload })
    vi.mocked(setAccountPassword).mockResolvedValue({ success: true })
    render(
      <ProfileAccountSection
        methods={{ ...methods, hasPassword: false } as never}
        {...props}
      />,
    )
    await setPassword()
    await waitFor(() =>
      expect(
        screen.queryByTestId("set-password-submit"),
      ).not.toBeInTheDocument(),
    )
    expect(setAccountPassword).toHaveBeenCalledWith({
      newPassword: "NouveauPassw0rd!",
    })
    expect(reload).not.toHaveBeenCalled()
  })

  it("après un mot de passe défini, le focus suit le bouton jusqu'à « Modifier »", async () => {
    vi.mocked(setAccountPassword).mockResolvedValue({ success: true })
    const { rerender } = render(
      <ProfileAccountSection
        methods={{ ...methods, hasPassword: false } as never}
        {...props}
      />,
    )
    await setPassword()
    await waitFor(() =>
      expect(screen.getByTestId("login-method-set-password")).toHaveFocus(),
    )
    rerender(<ProfileAccountSection methods={methods as never} {...props} />)
    expect(screen.getByTestId("login-method-change-password")).toHaveFocus()
  })
})
