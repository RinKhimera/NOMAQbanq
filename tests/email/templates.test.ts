import { render } from "@react-email/render"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { plainTextOptions } from "@/email/plain-text"
import { AbandonedCartEmail } from "@/email/templates/abandoned-cart-email"
import { AccessExpiringEmail } from "@/email/templates/access-expiring-email"
import { ExamResultsEmail } from "@/email/templates/exam-results-email"
import { InactivityReminderEmail } from "@/email/templates/inactivity-reminder-email"
import { PurchaseConfirmationEmail } from "@/email/templates/purchase-confirmation-email"
import { ResetPasswordEmail } from "@/email/templates/reset-password-email"
import { VerificationEmail } from "@/email/templates/verification-email"
import { WelcomeEmail } from "@/email/templates/welcome-email"

const NB = " "
const common = { firstName: "Samuel", baseUrl: "https://nomaqbanq.ca" }

/** Texte d'aperçu (préentête) tel que la boîte de réception l'affiche. */
const previewOf = (html: string) =>
  /data-skip-in-text="true">([^<]*)</.exec(html)?.[1].replaceAll("&#x27;", "'")

/** Texte visible, apostrophes décodées, pour comparer aux textes de la maquette. */
const textOf = (html: string) => html.replaceAll("&#x27;", "'")

describe("email templates", () => {
  it("verification email : lien, salutation, textes de la maquette", async () => {
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
    expect(html).toContain(`Bienvenue${NB}! Confirmez votre adresse`)
    expect(previewOf(html)).toBe("Un clic pour activer votre compte NOMAQbanq.")
  })

  it("reset password email : lien, avertissement, aperçu", async () => {
    const html = await render(
      createElement(ResetPasswordEmail, {
        ...common,
        url: "https://nomaqbanq.ca/r?token=xyz",
      }),
    )
    expect(html).toContain("https://nomaqbanq.ca/r?token=xyz")
    expect(html).toContain("Réinitialiser mon mot de passe")
    expect(textOf(html)).toContain(
      `ignorez ce message${NB}; votre mot de passe reste inchangé.`,
    )
    expect(previewOf(html)).toBe(
      "Choisissez un nouveau mot de passe. Ce lien expirera bientôt.",
    )
  })

  const resultsProps = {
    ...common,
    examTitle: "Examen blanc 3",
    resultUrl: "https://nomaqbanq.ca/tableau-de-bord/examen-blanc/e1/resultats",
  }

  it("exam results email, score affiché : score en monospace, aperçu chiffré", async () => {
    const html = await render(
      createElement(ExamResultsEmail, { ...resultsProps, score: 78 }),
    )
    expect(html).toContain("Vos résultats sont disponibles")
    expect(html).toContain("Examen blanc 3")
    expect(html).toMatch(new RegExp(`font-family:Menlo[^"]*">78${NB}%`))
    expect(html).toContain("Voir mes résultats")
    expect(html).toContain(resultsProps.resultUrl)
    expect(html).not.toContain("dès qu")
    expect(previewOf(html)).toBe(
      `Score${NB}: 78${NB}%. Le détail de chaque question est consultable dans votre espace.`,
    )
  })

  it("exam results email, score retenu : ni score ni date, ligne grise d'attente", async () => {
    const html = await render(
      createElement(ExamResultsEmail, { ...resultsProps, score: null }),
    )
    expect(html).not.toContain("Score")
    expect(textOf(html)).toContain(
      "Votre score sera affiché sur la page de résultats dès qu'il sera disponible.",
    )
    expect(previewOf(html)).toBe(
      "Le détail de chaque question est consultable dans votre espace.",
    )
    // Une marge négative n'est pas appliquée partout : l'écart se règle sur le récapitulatif.
    expect(html).not.toContain("margin:-")
  })

  it("access expiring email : prolonger, pluriel des jours, espaces insécables", async () => {
    const plural = await render(
      createElement(AccessExpiringEmail, {
        ...common,
        accessType: "exam",
        daysRemaining: 5,
        renewUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
      }),
    )
    expect(plural).toContain('data-variant="warning"')
    expect(plural).toContain(`Votre accès aux examens expire dans 5${NB}jours`)
    expect(textOf(plural)).toContain("tant qu'il n'est pas prolongé.")
    expect(plural).toContain("Prolonger mon accès")
    expect(plural).not.toContain("enouvel")
    expect(previewOf(plural)).toBe(
      `Prolongez-le maintenant${NB}: le temps restant s'ajoute à votre nouvel accès.`,
    )

    const singular = await render(
      createElement(AccessExpiringEmail, {
        ...common,
        accessType: "training",
        daysRemaining: 1,
        renewUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
      }),
    )
    expect(textOf(singular)).toContain(
      `Votre accès à l'entraînement expire dans 1${NB}jour<`,
    )
  })

  const confirmationProps = {
    ...common,
    productName: "Accès Examens - 6 mois",
    amountLabel: "200,00 $",
    presentmentLabel: "82 000 FCFA",
    purchasedAtLabel: "5 juin 2026",
    grantedAccess: [
      { label: "Accès Examens", expiresAtLabel: "2 décembre 2026" },
    ],
    accountUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
    supportEmail: "support@nomaqbanq.ca",
  }

  it("purchase confirmation email : produit, montant en monospace, libellé de relevé, accès, support", async () => {
    const html = await render(
      createElement(PurchaseConfirmationEmail, confirmationProps),
    )
    expect(html).toContain("Merci pour votre achat")
    expect(html).toContain("Accès Examens - 6 mois")
    expect(html).toMatch(/font-family:Menlo[^"]*">200,00 \$/)
    expect(html).toContain("soit environ 82 000 FCFA")
    expect(html).toContain("NOMAQBANQ")
    expect(html).toContain('data-variant="info"')
    expect(textOf(html)).toContain("jusqu'au 2 décembre 2026")
    expect(html).toContain("support@nomaqbanq.ca")
    expect(html).toContain(`Une question sur cet achat${NB}?`)
    expect(html).toContain("https://nomaqbanq.ca/tableau-de-bord/abonnements")
    expect(previewOf(html)).toBe(
      "Votre accès est activé jusqu'au 2 décembre 2026. Récapitulatif de votre commande.",
    )
  })

  it("purchase confirmation email, Pack Premium : une ligne par accès, aperçu daté si l'échéance est commune", async () => {
    const html = await render(
      createElement(PurchaseConfirmationEmail, {
        ...confirmationProps,
        productName: "Pack Premium - 6 mois",
        presentmentLabel: null,
        grantedAccess: [
          { label: "Accès Examens", expiresAtLabel: "2 décembre 2026" },
          { label: "Accès Entraînement", expiresAtLabel: "2 décembre 2026" },
        ],
      }),
    )
    expect(html).toContain("Accès Entraînement")
    expect(previewOf(html)).toBe(
      "Votre accès est activé jusqu'au 2 décembre 2026. Récapitulatif de votre commande.",
    )
  })

  it("purchase confirmation email : échéances différentes, aperçu sans date", async () => {
    const html = await render(
      createElement(PurchaseConfirmationEmail, {
        ...confirmationProps,
        grantedAccess: [
          { label: "Accès Examens", expiresAtLabel: "31 décembre 2026" },
          { label: "Accès Entraînement", expiresAtLabel: "2 décembre 2026" },
        ],
      }),
    )
    expect(previewOf(html)).toBe(
      "Votre accès est activé. Récapitulatif de votre commande.",
    )
  })

  // Le corps `Text` envoyé par SES est ce rendu : le récapitulatif doit y rester
  // lisible, une donnée par ligne, pas des cellules collées.
  it("purchase confirmation email : le texte brut garde une ligne par donnée du récapitulatif", async () => {
    const text = await render(
      createElement(PurchaseConfirmationEmail, confirmationProps),
      plainTextOptions,
    )
    expect(text).not.toContain("ProduitAccès")
    expect(text).toMatch(/Produit\s+Accès Examens - 6 mois/)
    expect(text).toMatch(/Montant\s+200,00 \$/)
    expect(text).not.toContain("$soit")
    expect(text).toContain("soit environ 82 000 FCFA")
    expect(text).toMatch(/Date\s+5 juin 2026/)
    expect(text).toMatch(/Accès Examens\s+jusqu'au 2 décembre 2026/)
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

describe("courriels de cycle de vie", () => {
  it("welcome email : transactionnel, trois étapes numérotées, tableau de bord", async () => {
    const html = await render(createElement(WelcomeEmail, common))
    expect(html).toContain("Bienvenue sur NOMAQbanq")
    expect(html).toContain("Bonjour Samuel,")
    expect(html).toContain(`Pour bien commencer${NB}:`)
    expect(html).toContain(">01</td>")
    expect(html).toContain(">03</td>")
    expect(html).toContain('href="https://nomaqbanq.ca/tableau-de-bord/profil"')
    expect(html).toContain(
      'href="https://nomaqbanq.ca/tableau-de-bord/entrainement"',
    )
    expect(html).toContain(
      'href="https://nomaqbanq.ca/tableau-de-bord/examen-blanc"',
    )
    expect(html).toContain("Accéder à mon tableau de bord")
    expect(html).not.toContain("Ne plus recevoir ces rappels")
    expect(previewOf(html)).toBe(
      "Votre compte est activé. Trois étapes pour bien commencer.",
    )
  })

  it("inactivity reminder : commercial avec désabonnement, bouton entraînement", async () => {
    const html = await render(
      createElement(InactivityReminderEmail, {
        ...common,
        unsubscribeUrl: "https://nomaqbanq.ca/desabonnement?token=abc",
      }),
    )
    expect(html).toContain("Votre préparation vous attend")
    expect(html).toContain(`garder le rythme${NB}:`)
    expect(html).toContain("Reprendre l")
    expect(html).toContain(
      'href="https://nomaqbanq.ca/tableau-de-bord/entrainement"',
    )
    expect(html).toContain("Ne plus recevoir ces rappels")
    expect(html).toContain(
      'href="https://nomaqbanq.ca/desabonnement?token=abc"',
    )
    expect(previewOf(html)).toBe(
      "Votre progression est intacte. Quelques questions suffisent pour reprendre.",
    )
  })

  it("abandoned cart : commercial, récapitulatif produit et prix, sans promesse de contenu", async () => {
    const html = await render(
      createElement(AbandonedCartEmail, {
        ...common,
        unsubscribeUrl: "https://nomaqbanq.ca/desabonnement?token=abc",
        productName: "Accès Examens - 6 mois",
        priceLabel: "200,00 $",
      }),
    )
    expect(html).toContain("Votre commande n")
    expect(html).toContain("Accès Examens - 6 mois")
    expect(html).toMatch(/font-family:Menlo[^"]*">200,00 \$/)
    expect(html).toContain("Reprendre mon achat")
    expect(html).toContain('href="https://nomaqbanq.ca/tarifs"')
    expect(html).toContain("Ne plus recevoir ces rappels")
    expect(html).not.toContain("débloque")
    expect(html).not.toContain("rabais")
    expect(previewOf(html)).toBe(
      "Aucun accès n'a été activé. Reprenez votre achat quand vous le souhaitez.",
    )
  })
})
