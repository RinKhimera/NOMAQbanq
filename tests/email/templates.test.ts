import { render } from "@react-email/render"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { AccessExpiringEmail } from "@/email/templates/access-expiring-email"
import { ExamResultsEmail } from "@/email/templates/exam-results-email"
import { PurchaseConfirmationEmail } from "@/email/templates/purchase-confirmation-email"
import { ResetPasswordEmail } from "@/email/templates/reset-password-email"
import { VerificationEmail } from "@/email/templates/verification-email"

const common = { firstName: "Samuel", baseUrl: "https://nomaqbanq.ca" }

describe("email templates", () => {
  it("verification email contains the url and FR copy", async () => {
    const html = await render(
      createElement(VerificationEmail, {
        ...common,
        url: "https://nomaqbanq.ca/v?token=abc",
      }),
    )
    expect(html).toContain("https://nomaqbanq.ca/v?token=abc")
    expect(html).toContain("Vérifier mon adresse")
    expect(html).toContain("Bonjour Samuel,")
    expect(html).toContain("Confirmez votre adresse courriel")
  })

  it("reset password email contains the url and FR copy", async () => {
    const html = await render(
      createElement(ResetPasswordEmail, {
        ...common,
        url: "https://nomaqbanq.ca/r?token=xyz",
      }),
    )
    expect(html).toContain("https://nomaqbanq.ca/r?token=xyz")
    expect(html).toContain("Réinitialiser mon mot de passe")
    expect(html).toContain("votre mot de passe reste inchangé")
  })

  it("exam results email : titre, score en récapitulatif, bouton", async () => {
    const html = await render(
      createElement(ExamResultsEmail, {
        ...common,
        examTitle: "Examen blanc 3",
        score: 78,
        resultUrl:
          "https://nomaqbanq.ca/tableau-de-bord/examen-blanc/e1/resultats",
      }),
    )
    expect(html).toContain("Vos résultats sont disponibles")
    expect(html).toContain("Examen blanc 3")
    expect(html).toContain("78 %")
    expect(html).toContain("Voir mes résultats")
    expect(html).toContain(
      "https://nomaqbanq.ca/tableau-de-bord/examen-blanc/e1/resultats",
    )
  })

  it("access expiring email : avertissement, pluriel des jours, bouton", async () => {
    const plural = await render(
      createElement(AccessExpiringEmail, {
        ...common,
        accessType: "exam",
        daysRemaining: 5,
        renewUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
      }),
    )
    expect(plural).toContain('data-variant="warning"')
    expect(plural).toContain("expire dans 5 jours")
    expect(plural).toContain("aux examens")
    expect(plural).toContain("Renouveler mon accès")

    const singular = await render(
      createElement(AccessExpiringEmail, {
        ...common,
        accessType: "training",
        daysRemaining: 1,
        renewUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
      }),
    )
    expect(singular).toContain("expire dans 1 jour<")
  })

  const confirmationProps = {
    ...common,
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
    expect(html).toContain("Merci pour votre achat")
    expect(html).toContain("Accès examens — 90 jours")
    expect(html).toContain("200,00 $")
    expect(html).toContain("228 000 FCFA")
    expect(html).toContain("NOMAQBANQ")
    expect(html).toContain('data-variant="info"')
    expect(html).toContain("Accès aux examens")
    expect(html).toContain("31 décembre 2026")
    expect(html).toContain("2 octobre 2026")
    expect(html).toContain("support@nomaqbanq.ca")
    expect(html).toContain("https://nomaqbanq.ca/tableau-de-bord/abonnements")
  })

  // Le corps `Text` envoyé par SES est ce rendu : le récapitulatif doit y rester
  // lisible, une donnée par ligne, pas des cellules collées.
  it("purchase confirmation email : le texte brut garde une ligne par donnée du récapitulatif", async () => {
    const text = await render(
      createElement(PurchaseConfirmationEmail, confirmationProps),
      { plainText: true },
    )
    expect(text).not.toContain("ProduitAccès")
    expect(text).toMatch(/Produit\s+Accès examens — 90 jours/)
    expect(text).toMatch(/Montant\s+200,00 \$/)
    expect(text).not.toContain("$soit")
    expect(text).toContain("soit environ 228 000 FCFA")
    expect(text).toMatch(/Date\s+2 septembre 2026/)
    expect(text).toContain("Bonjour Samuel,")
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
