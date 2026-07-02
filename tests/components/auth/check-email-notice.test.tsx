import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CheckEmailNotice } from "@/app/(auth)/_components/check-email-notice"

const sendVerificationEmail = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    sendVerificationEmail: (...args: unknown[]) =>
      sendVerificationEmail(...args),
  },
}))
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("CheckEmailNotice", () => {
  it("affiche l'adresse et le titre en mode signup", () => {
    render(<CheckEmailNotice email="astrid@example.com" mode="signup" />)
    expect(screen.getByTestId("auth-check-email")).toBeInTheDocument()
    expect(screen.getByText(/astrid@example.com/)).toBeInTheDocument()
    expect(
      screen.getByText(/Vérifiez votre boîte courriel/),
    ).toBeInTheDocument()
  })

  it("renvoie le lien puis désactive le bouton (cooldown)", async () => {
    sendVerificationEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<CheckEmailNotice email="a@b.com" mode="verify" />)

    await user.click(screen.getByTestId("auth-resend"))

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "a@b.com",
      callbackURL: "/tableau-de-bord",
    })
    expect(toastSuccess).toHaveBeenCalled()
    expect(screen.getByTestId("auth-resend")).toBeDisabled()
  })

  it("affiche un toast d'erreur si le renvoi échoue", async () => {
    sendVerificationEmail.mockResolvedValue({ error: { status: 429 } })
    const user = userEvent.setup()
    render(<CheckEmailNotice email="a@b.com" mode="verify" />)

    await user.click(screen.getByTestId("auth-resend"))

    expect(toastError).toHaveBeenCalled()
  })
})
