import { render } from "@react-email/render"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { PurchaseConfirmationEmail } from "@/email/templates/purchase-confirmation-email"
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

  const confirmationProps = {
    productName: "Accès examens — 90 jours",
    amountLabel: "200,00 $",
    presentmentLabel: "228 000 FCFA",
    purchasedAtLabel: "2 septembre 2026",
    grantedAccess: [
      { label: "Accès aux examens", expiresAtLabel: "31 décembre 2026" },
      { label: "Accès à l'entraînement", expiresAtLabel: "2 octobre 2026" },
    ],
    accountUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
    supportEmail: "support@nomaqbanq.ca",
  }

  it("purchase confirmation email : produit, montant, libellé de relevé, un accès par ligne, support", async () => {
    const html = await render(
      createElement(PurchaseConfirmationEmail, confirmationProps),
    )
    expect(html).toContain("Accès examens — 90 jours")
    expect(html).toContain("200,00 $")
    expect(html).toContain("228 000 FCFA")
    expect(html).toContain("NOMAQBANQ")
    expect(html).toContain("Accès aux examens")
    expect(html).toContain("31 décembre 2026")
    expect(html).toContain("2 octobre 2026")
    expect(html).toContain("support@nomaqbanq.ca")
    expect(html).toContain("https://nomaqbanq.ca/tableau-de-bord/abonnements")
  })

  it("purchase confirmation email : sans montant local ni support, aucune mention correspondante", async () => {
    const html = await render(
      createElement(PurchaseConfirmationEmail, {
        ...confirmationProps,
        presentmentLabel: null,
        supportEmail: null,
      }),
    )
    expect(html).not.toContain("soit environ")
    expect(html).not.toContain("Écrivez-nous")
  })
})
