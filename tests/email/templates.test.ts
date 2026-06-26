import { render } from "@react-email/render"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { ResetPasswordEmail } from "@/email/templates/reset-password-email"
import { VerificationEmail } from "@/email/templates/verification-email"

describe("email templates", () => {
  it("verification email contains the url and FR copy", async () => {
    const html = await render(
      createElement(VerificationEmail, {
        url: "https://nomaqbanq.ca/v?token=abc",
      }),
    )
    expect(html).toContain("https://nomaqbanq.ca/v?token=abc")
    expect(html).toContain("Vérifier mon adresse")
  })

  it("reset password email contains the url and FR copy", async () => {
    const html = await render(
      createElement(ResetPasswordEmail, {
        url: "https://nomaqbanq.ca/r?token=xyz",
      }),
    )
    expect(html).toContain("https://nomaqbanq.ca/r?token=xyz")
    expect(html).toContain("Réinitialiser mon mot de passe")
  })
})
