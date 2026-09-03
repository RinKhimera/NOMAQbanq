import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileLoginMethods } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-login-methods"

const { unlinkAccount } = vi.hoisted(() => ({
  unlinkAccount: vi.fn(async () => ({ error: null })),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: vi.fn(),
    unlinkAccount,
    sendVerificationEmail: vi.fn(),
  },
}))

beforeEach(() => {
  unlinkAccount.mockClear()
})

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

  it("délie Google par l'id de la ligne account, pas par le fournisseur", async () => {
    vi.stubGlobal("location", { ...location, reload: vi.fn() })
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
    vi.unstubAllGlobals()
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
