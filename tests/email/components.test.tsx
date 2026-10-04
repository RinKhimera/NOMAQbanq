import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"
import { EmailButton } from "@/email/components/email-button"
import { EmailFallbackLink } from "@/email/components/email-fallback-link"
import { EmailNotice } from "@/email/components/email-notice"
import { EmailParagraph } from "@/email/components/email-paragraph"
import { EmailRecap } from "@/email/components/email-recap"
import { EmailSteps } from "@/email/components/email-steps"
import { emailBrand, emailTheme } from "@/email/theme"

describe("emailTheme / emailBrand", () => {
  it("porte les jetons clairs du design system et l'identité de l'expéditeur", () => {
    expect(emailTheme.colors.accent).toBe("#2563eb")
    expect(emailTheme.colors.page).toBe("#fbfbfa")
    expect(emailTheme.colors.line).toBe("#e6e4df")
    expect(emailTheme.fonts.serif).toMatch(/^Georgia/)
    expect(emailBrand.postalAddress).toBe(
      "114 rue Isabelle, Gatineau (Québec) J8Y 5H3",
    )
    expect(emailBrand.links.help).toBe("/faq")
  })
})

describe("EmailParagraph", () => {
  it("texte courant par défaut, petit texte gris en muted", async () => {
    const main = await render(<EmailParagraph>Texte principal</EmailParagraph>)
    expect(main).toContain("Texte principal")
    expect(main).toContain("font-size:16px")
    expect(main).toContain("color:#3f4a5c")

    const muted = await render(<EmailParagraph muted>Note</EmailParagraph>)
    expect(muted).toContain("font-size:13px")
    expect(muted).toContain("color:#5b6678")
  })
})

describe("EmailButton", () => {
  it("aplat bleu en largeur naturelle, classe de la règle mobile", async () => {
    const html = await render(
      <EmailButton href="https://nomaqbanq.ca/x">Voir mes accès</EmailButton>,
    )
    expect(html).toContain('href="https://nomaqbanq.ca/x"')
    expect(html).toContain("Voir mes accès")
    expect(html).toContain("background-color:#2563eb")
    expect(html).toContain('class="nq-btn"')
    expect(html).not.toContain("width:100%")
  })
})

describe("EmailFallbackLink", () => {
  it("répète l'URL en clair, cliquable, en monospace", async () => {
    const html = await render(
      <EmailFallbackLink href="https://nomaqbanq.ca/r?token=abc" />,
    )
    expect(html).toContain('href="https://nomaqbanq.ca/r?token=abc"')
    expect(html).toContain("Ou copiez ce lien dans votre navigateur :")
    expect(html).toMatch(
      /<a[^>]*font-family:Menlo[^>]*>https:\/\/nomaqbanq\.ca\/r\?token=abc<\/a>/,
    )
  })
})

describe("EmailRecap", () => {
  const rows = [
    { label: "Produit", value: "Accès Examens - 6 mois" },
    {
      label: "Montant",
      value: "200,00 $",
      sub: "soit environ 82 000 FCFA",
      mono: true,
    },
    { label: "Date", value: "5 juin 2026", sub: null },
  ]

  it("rend chaque ligne entre filets, la sous-ligne seulement si fournie", async () => {
    const html = await render(<EmailRecap rows={rows} />)
    expect(html).toContain("Produit")
    expect(html).toContain("Accès Examens - 6 mois")
    expect(html).toContain("5 juin 2026")
    expect(html.match(/soit environ/g)).toHaveLength(1)
    expect(html).toContain("border-bottom:1px solid #e6e4df")
  })

  it("une valeur chiffrée s'écrit en monospace, les autres non", async () => {
    const html = await render(<EmailRecap rows={rows} />)
    expect(html).toMatch(/<span style="font-family:Menlo[^"]*">200,00 \$/)
    expect(html).not.toMatch(/font-family:Menlo[^"]*">Accès Examens/)
  })
})

describe("EmailNotice", () => {
  it.each([
    ["info", "#eff6ff", "#bfdbfe"],
    ["warning", "#fffbeb", "#fde68a"],
    ["success", "#ecfdf5", "#a7f3d0"],
  ] as const)(
    "tonalité %s : fond et filet de la teinte",
    async (variant, background, line) => {
      const html = await render(
        <EmailNotice variant={variant}>{"Contenu de l'avis"}</EmailNotice>,
      )
      expect(html).toContain(`data-variant="${variant}"`)
      expect(html).toContain(`background-color:${background}`)
      expect(html).toContain(`border:1px solid ${line}`)
      expect(html).toContain("Contenu de l")
    },
  )
})

describe("EmailSteps", () => {
  const steps = [<>Premier pas</>, <>Deuxième pas</>, <>Troisième pas</>]

  it("numérote les étapes 01 02 03 en monospace", async () => {
    const html = await render(<EmailSteps items={steps} />)
    expect(html).toMatch(/font-family:Menlo[^"]*">01<\/td>/)
    expect(html).toContain(">02</td>")
    expect(html).toContain(">03</td>")
    expect(html).toContain("Troisième pas")
  })

  it("texte brut : une étape par ligne, numéro compris", async () => {
    const text = await render(<EmailSteps items={steps} />, {
      plainText: true,
    })
    expect(text).toMatch(/01\s+Premier pas\n/)
    expect(text).toMatch(/03\s+Troisième pas/)
  })
})
