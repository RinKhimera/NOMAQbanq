import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SignUpForm } from "@/app/(auth)/inscription/_components/sign-up-form"

const signUpEmail = vi.fn()
const signInSocial = vi.fn()
const sendVerificationEmail = vi.fn()
const push = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: (...a: unknown[]) => signUpEmail(...a) },
    signIn: { social: (...a: unknown[]) => signInSocial(...a) },
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
  await user.type(screen.getByTestId("auth-name"), "Marie Dupont")
  await user.type(screen.getByTestId("auth-email"), "marie@example.com")
  await user.type(screen.getByTestId("auth-password"), "password123")
  await user.click(screen.getByTestId("auth-submit"))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SignUpForm", () => {
  it("bascule vers l'écran de vérification au succès (pas de redirection dashboard)", async () => {
    signUpEmail.mockResolvedValue({ error: null })
    render(<SignUpForm />)
    await fillAndSubmit()

    expect(await screen.findByTestId("auth-check-email")).toBeInTheDocument()
    expect(screen.getByText(/marie@example.com/)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("affiche une alerte sur erreur", async () => {
    signUpEmail.mockResolvedValue({
      error: { code: "SOMETHING", status: 400 },
    })
    render(<SignUpForm />)
    await fillAndSubmit()

    expect(await screen.findByTestId("auth-error-alert")).toBeInTheDocument()
  })
})
