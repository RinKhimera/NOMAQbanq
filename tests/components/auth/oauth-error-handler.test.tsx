import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OAuthErrorHandler } from "@/app/(auth)/connexion/_components/oauth-error-handler"

const replace = vi.fn()
const toastError = vi.fn()
let params = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
}))
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a) },
}))

beforeEach(() => {
  replace.mockReset()
  toastError.mockReset()
})

describe("OAuthErrorHandler", () => {
  it("ne fait rien sans paramètre error", () => {
    params = new URLSearchParams()
    render(<OAuthErrorHandler />)
    expect(replace).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("BANNED_USER → /compte-suspendu", () => {
    params = new URLSearchParams("error=BANNED_USER")
    render(<OAuthErrorHandler />)
    expect(replace).toHaveBeenCalledWith("/compte-suspendu")
    expect(toastError).not.toHaveBeenCalled()
  })

  it("autre erreur → toast générique et URL nettoyée", () => {
    params = new URLSearchParams("error=unable_to_create_user")
    render(<OAuthErrorHandler />)
    expect(toastError).toHaveBeenCalledWith(
      "La connexion avec Google a échoué. Réessayez.",
    )
    expect(replace).toHaveBeenCalledWith("/connexion")
  })
})
