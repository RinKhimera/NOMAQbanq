import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"
import { EmailLayout } from "@/email/templates/email-layout"

const baseUrl = "https://nomaqbanq.ca"

describe("EmailLayout", () => {
  it("transactionnel : marque, titre, salutation, pied de page, sans bloc de désabonnement", async () => {
    const html = await render(
      <EmailLayout
        category="transactional"
        preview="Aperçu"
        heading="Merci pour votre achat"
        firstName="Samuel"
        baseUrl={baseUrl}
      >
        <p>Corps</p>
      </EmailLayout>,
    )
    expect(html).toContain('lang="fr"')
    expect(html).toContain('name="color-scheme"')
    expect(html).toContain('src="https://nomaqbanq.ca/icons/icon-192.png"')
    expect(html).toContain("NOMAQ")
    expect(html).toContain("banq")
    expect(html).toContain("Merci pour votre achat")
    expect(html).toContain("Bonjour Samuel,")
    expect(html).toContain("Corps")
    expect(html).toContain("114 rue Isabelle, Gatineau (Québec) J8Y 5H3")
    expect(html).toContain('href="https://nomaqbanq.ca/faq"')
    expect(html).toContain('href="https://nomaqbanq.ca/conditions"')
    expect(html).toContain('href="https://nomaqbanq.ca/confidentialite"')
    expect(html).not.toContain("Ne plus recevoir ces rappels")
  })

  it("sans prénom : aucune salutation", async () => {
    const html = await render(
      <EmailLayout
        category="transactional"
        preview="Aperçu"
        heading="Titre"
        firstName={null}
        baseUrl={baseUrl}
      >
        <p>Corps</p>
      </EmailLayout>,
    )
    expect(html).not.toContain("Bonjour")
  })

  it("commercial : bloc de désabonnement avec le lien fourni et le lien préférences", async () => {
    const html = await render(
      <EmailLayout
        category="commercial"
        unsubscribeUrl="https://nomaqbanq.ca/desabonnement?token=abc"
        preview="Aperçu"
        heading="On ne vous voit plus"
        firstName="Samuel"
        baseUrl={baseUrl}
      >
        <p>Corps</p>
      </EmailLayout>,
    )
    expect(html).toContain("Ne plus recevoir ces rappels")
    expect(html).toContain(
      'href="https://nomaqbanq.ca/desabonnement?token=abc"',
    )
    expect(html).toContain('href="https://nomaqbanq.ca/tableau-de-bord/profil"')
  })

  // tsc ancre TS2322 sur la BALISE (intersection dont un membre est une union),
  // pas sur l'attribut fautif : la directive doit précéder `<EmailLayout`.
  it("le type interdit un commercial sans désabonnement et un transactionnel avec", () => {
    const build = () => [
      // @ts-expect-error commercial sans unsubscribeUrl
      <EmailLayout
        key="a"
        category="commercial"
        preview="p"
        heading="h"
        baseUrl={baseUrl}
      >
        x
      </EmailLayout>,
      // @ts-expect-error transactionnel avec unsubscribeUrl
      <EmailLayout
        key="b"
        category="transactional"
        unsubscribeUrl="https://x"
        preview="p"
        heading="h"
        baseUrl={baseUrl}
      >
        x
      </EmailLayout>,
    ]
    expect(build).toBeTypeOf("function")
  })

  it("rend aussi un texte brut lisible (liens inclus, image ignorée)", async () => {
    const text = await render(
      <EmailLayout
        category="transactional"
        preview="Aperçu"
        heading="Titre"
        firstName="Samuel"
        baseUrl={baseUrl}
      >
        <p>Corps</p>
      </EmailLayout>,
      { plainText: true },
    )
    expect(text).toContain("Bonjour Samuel,")
    expect(text).toContain("Corps")
    expect(text).toContain("https://nomaqbanq.ca/faq")
  })
})
