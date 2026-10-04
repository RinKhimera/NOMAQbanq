import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"
import { plainTextOptions } from "@/email/plain-text"
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
    expect(html).toContain("114 rue Isabelle, Gatineau (Québec) J8Y 5H3")
    expect(html).toContain('href="https://nomaqbanq.ca/faq"')
    expect(html).toContain('href="https://nomaqbanq.ca/conditions"')
    expect(html).toContain('href="https://nomaqbanq.ca/confidentialite"')
    expect(html).not.toContain("Ne plus recevoir ces rappels")
  })

  it("style Manuel : marque aux couleurs du site, titre serif, aucun dégradé ni police web", async () => {
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
    expect(html).toMatch(/NOMAQ<span style="color:#2563eb[^"]*">banq<\/span>/)
    expect(html).toContain("Préparation à l&#x27;EACMC Partie I")
    expect(html).toMatch(/<h1[^>]*font-family:Georgia/)
    expect(html).toContain("background-color:#fbfbfa")
    expect(html).toContain("border:1px solid #e6e4df")
    expect(html).toContain("border-radius:6px")
    // Un arrondi posé sur une cellule n'est rendu que si sa table garde des
    // bordures séparées : en `collapse`, les coins restent carrés.
    expect(html).toMatch(
      /<table[^>]*max-width:480px[^"]*border-collapse:separate/,
    )
    expect(html).not.toMatch(/gradient/i)
    expect(html).not.toMatch(/Plus Jakarta|IBM Plex|Source Serif/)
    expect(html).not.toMatch(/@import|@font-face|<link/)
  })

  it("règle @media : le bouton passe en pleine largeur sous 480 px", async () => {
    const html = await render(
      <EmailLayout
        category="transactional"
        preview="Aperçu"
        heading="Titre"
        baseUrl={baseUrl}
      >
        <p>Corps</p>
      </EmailLayout>,
    )
    expect(html).toMatch(
      /@media only screen and \(max-width: ?479px\)\s*\{[^<]*\.nq-btn\s*\{[^}]*width:\s*100%\s*!important/,
    )
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
      plainTextOptions,
    )
    expect(text).toContain("Bonjour Samuel,")
    expect(text).toContain("Corps")
    expect(text).toContain("https://nomaqbanq.ca/faq")
  })

  // html-to-text met un h1 en capitales par défaut : « NOMAQBANQ » déformerait la marque.
  it("texte brut : le titre garde sa casse", async () => {
    const text = await render(
      <EmailLayout
        category="transactional"
        preview="Aperçu"
        heading="Bienvenue sur NOMAQbanq"
        baseUrl={baseUrl}
      >
        <p>Corps</p>
      </EmailLayout>,
      plainTextOptions,
    )
    expect(text).toContain("Bienvenue sur NOMAQbanq")
    expect(text).not.toContain("BIENVENUE")
  })
})
