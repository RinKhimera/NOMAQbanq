import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"
import { EmailButton } from "@/email/components/email-button"
import { EmailFallbackLink } from "@/email/components/email-fallback-link"
import { EmailParagraph } from "@/email/components/email-paragraph"
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
