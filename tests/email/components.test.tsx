import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"
import { EmailButton } from "@/email/components/email-button"
import { EmailFallbackLink } from "@/email/components/email-fallback-link"
import { EmailNotice } from "@/email/components/email-notice"
import { EmailParagraph } from "@/email/components/email-paragraph"
import { EmailRecap } from "@/email/components/email-recap"
import { emailBrand, emailTheme } from "@/email/theme"

describe("emailTheme / emailBrand", () => {
  it("porte les couleurs de marque du site et l'identité de l'expéditeur", () => {
    expect(emailTheme.colors.accent).toBe("#2563eb")
    expect(emailTheme.colors.accentEnd).toBe("#4338ca")
    expect(emailTheme.colors.success).toBe("#059669")
    expect(emailBrand.postalAddress).toBe(
      "114 rue Isabelle, Gatineau (Québec) J8Y 5H3",
    )
    expect(emailBrand.links.help).toBe("/faq")
  })
})

describe("EmailParagraph", () => {
  it("texte principal par défaut, secondaire en muted", async () => {
    const main = await render(<EmailParagraph>Texte principal</EmailParagraph>)
    expect(main).toContain("Texte principal")
    expect(main).toContain(emailTheme.colors.text)

    const muted = await render(<EmailParagraph muted>Note</EmailParagraph>)
    expect(muted).toContain(emailTheme.colors.muted)
  })
})

describe("EmailButton", () => {
  it("rend un lien plein bleu avec le libellé", async () => {
    const html = await render(
      <EmailButton href="https://nomaqbanq.ca/x">Voir mes accès</EmailButton>,
    )
    expect(html).toContain('href="https://nomaqbanq.ca/x"')
    expect(html).toContain("Voir mes accès")
    expect(html).toContain(emailTheme.colors.accent)
  })
})

describe("EmailFallbackLink", () => {
  it("répète l'URL en clair, cliquable", async () => {
    const html = await render(
      <EmailFallbackLink href="https://nomaqbanq.ca/r?token=abc" />,
    )
    expect(html).toContain('href="https://nomaqbanq.ca/r?token=abc"')
    expect(html).toContain("Ou copiez ce lien")
    expect(html).toContain("https://nomaqbanq.ca/r?token=abc</a>")
  })
})

describe("EmailRecap", () => {
  it("rend chaque ligne clé/valeur et la sous-ligne seulement si fournie", async () => {
    const html = await render(
      <EmailRecap
        rows={[
          { label: "Produit", value: "Accès aux examens — 90 jours" },
          {
            label: "Montant",
            value: "200,00 $",
            sub: "soit environ 228 000 FCFA",
          },
          { label: "Date", value: "3 septembre 2026", sub: null },
        ]}
      />,
    )
    expect(html).toContain("Produit")
    expect(html).toContain("Accès aux examens — 90 jours")
    expect(html).toContain("soit environ 228 000 FCFA")
    expect(html).toContain("3 septembre 2026")
    expect(html.match(/soit environ/g)).toHaveLength(1)
  })
})

describe("EmailNotice", () => {
  it.each([
    ["info", emailTheme.colors.accent],
    ["warning", emailTheme.colors.warning],
    ["success", emailTheme.colors.success],
  ] as const)("variante %s : filet de la teinte", async (variant, rule) => {
    const html = await render(
      <EmailNotice variant={variant}>Contenu de l'avis</EmailNotice>,
    )
    expect(html).toContain(`data-variant="${variant}"`)
    expect(html).toContain(rule)
    expect(html).toContain("Contenu de l")
  })
})
