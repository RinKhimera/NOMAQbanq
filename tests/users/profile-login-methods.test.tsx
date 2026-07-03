import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileLoginMethods } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-login-methods"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
}))

describe("ProfileLoginMethods", () => {
  it("propose de définir un mot de passe pour un compte Google-only", () => {
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: false,
          google: { linked: true, linkedAt: new Date() },
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

  it("propose de lier Google et affiche non vérifié + renvoi", () => {
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: true,
          google: { linked: false, linkedAt: null },
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
          google: { linked: false, linkedAt: null },
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
