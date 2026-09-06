import { Link } from "@react-email/components"
import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { emailTheme } from "../theme"
import { EmailLayout } from "./email-layout"

const step = {
  fontFamily: emailTheme.fontFamily,
  fontSize: "15px",
  lineHeight: "1.6",
  color: emailTheme.colors.text,
  margin: "0 0 8px",
} as const
const link = { color: emailTheme.colors.accent } as const

export function WelcomeEmail({
  firstName,
  baseUrl,
}: {
  firstName: string | null
  baseUrl: string
}) {
  const dashboardUrl = `${baseUrl}/tableau-de-bord`
  return (
    <EmailLayout
      category="transactional"
      preview="Votre compte est activé : voici par où commencer"
      heading="Bienvenue sur NOMAQbanq"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Votre compte est activé. Vous avez accès aux questions
        d&apos;entraînement par domaine, aux examens blancs et au suivi de votre
        progression.
      </EmailParagraph>
      <EmailParagraph>Pour bien commencer :</EmailParagraph>
      <ol style={{ paddingLeft: "20px", margin: "0 0 16px" }}>
        <li style={step}>
          <Link href={`${baseUrl}/tableau-de-bord/profil`} style={link}>
            Complétez votre profil
          </Link>{" "}
          pour personnaliser votre espace.
        </li>
        <li style={step}>
          <Link href={`${baseUrl}/tableau-de-bord/entrainement`} style={link}>
            Lancez un premier entraînement
          </Link>{" "}
          sur le domaine de votre choix.
        </li>
        <li style={step}>
          <Link href={`${baseUrl}/tableau-de-bord/examen-blanc`} style={link}>
            Découvrez les examens blancs
          </Link>{" "}
          chronométrés, dans les conditions de l&apos;EACMC.
        </li>
      </ol>
      <EmailButton href={dashboardUrl}>
        Accéder à mon tableau de bord
      </EmailButton>
      <EmailFallbackLink href={dashboardUrl} />
    </EmailLayout>
  )
}
