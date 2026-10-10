import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileLoginMethods } from "@/components/shared/profile/profile-login-methods"

const { unlinkAccount, refresh } = vi.hoisted(() => ({
  unlinkAccount: vi.fn(async () => ({ error: null })),
  refresh: vi.fn(),
}))

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: vi.fn(),
    unlinkAccount,
    sendVerificationEmail: vi.fn(),
  },
}))

describe("ProfileLoginMethods", () => {
  it("propose de définir un mot de passe pour un compte Google-only", () => {
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: false,
          google: { linked: true, linkedAt: new Date(), accountId: "acc-1" },
          emailVerified: true,
        }}
        email="a@b.com"
        googleEnabled
        profilePath="/tableau-de-bord/profil"
      />,
    )
    expect(screen.getByTestId("login-method-set-password")).toBeInTheDocument()
    expect(screen.getByText(/Vérifié/i)).toBeInTheDocument()
    expect(screen.getByTestId("login-method-google-unlink")).toBeInTheDocument()
  })

  it("délie Google par l'id de la ligne account, puis rafraîchit sans recharger la page", async () => {
    const reload = vi.fn()
    vi.stubGlobal("location", { ...location, reload })
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: true,
          google: { linked: true, linkedAt: new Date(), accountId: "acc-42" },
          emailVerified: true,
        }}
        email="a@b.com"
        googleEnabled
        profilePath="/tableau-de-bord/profil"
      />,
    )
    fireEvent.click(screen.getByTestId("login-method-google-unlink"))
    await waitFor(() => expect(unlinkAccount).toHaveBeenCalledTimes(1))
    expect(unlinkAccount).toHaveBeenCalledWith({ accountId: "acc-42" })
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(reload).not.toHaveBeenCalled()
  })

  it("propose de lier Google et affiche non vérifié + renvoi", () => {
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: true,
          google: { linked: false },
          emailVerified: false,
        }}
        email="a@b.com"
        googleEnabled
        profilePath="/tableau-de-bord/profil"
      />,
    )
    expect(screen.getByTestId("login-method-google-link")).toBeInTheDocument()
    expect(
      screen.getByTestId("login-method-resend-verification"),
    ).toBeInTheDocument()
    expect(screen.getByText(/Non vérifié/i)).toBeInTheDocument()
  })

  it("masque toute l'UI Google si Google n'est pas configuré", () => {
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: true,
          google: { linked: false },
          emailVerified: true,
        }}
        email="a@b.com"
        googleEnabled={false}
        profilePath="/tableau-de-bord/profil"
      />,
    )
    expect(screen.queryByTestId("login-method-google-link")).toBeNull()
    expect(screen.queryByTestId("login-method-google-unlink")).toBeNull()
  })
})
