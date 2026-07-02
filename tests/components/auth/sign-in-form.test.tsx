import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SignInForm } from "@/app/(auth)/connexion/_components/sign-in-form"

const signInEmail = vi.fn()
const signInSocial = vi.fn()
const sendVerificationEmail = vi.fn()
const push = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: (...a: unknown[]) => signInEmail(...a),
      social: (...a: unknown[]) => signInSocial(...a),
    },
    sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByTestId("auth-email"), "user@example.com")
  await user.type(screen.getByTestId("auth-password"), "password123")
  await user.click(screen.getByTestId("auth-submit"))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SignInForm", () => {
  it("redirige vers /dashboard au succès", async () => {
    signInEmail.mockResolvedValue({ error: null })
    render(<SignInForm />)
    await fillAndSubmit()
    expect(push).toHaveBeenCalledWith("/dashboard")
  })

  it("affiche l'alerte actionnable avec lien reset sur identifiants invalides", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    })
    render(<SignInForm />)
    await fillAndSubmit()

    const alert = await screen.findByTestId("auth-error-alert")
    expect(alert).toBeInTheDocument()
    const resetLink = screen.getByRole("link", { name: /Réinitialisez-le/ })
    expect(resetLink).toHaveAttribute("href", "/mot-de-passe-oublie")
  })

  it("bascule vers l'écran de vérification sur EMAIL_NOT_VERIFIED", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED", status: 403 },
    })
    render(<SignInForm />)
    await fillAndSubmit()

    expect(await screen.findByTestId("auth-check-email")).toBeInTheDocument()
  })
})
