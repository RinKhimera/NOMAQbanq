import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailSteps } from "../components/email-steps"
import { emailTheme } from "../theme"
import { EmailLayout } from "./email-layout"

const link = { color: emailTheme.colors.accent, textDecoration: "underline" }

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
      preview="Votre compte est activé. Trois étapes pour bien commencer."
      heading="Bienvenue sur NOMAQbanq"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Votre compte est activé. Vous avez accès aux questions
        d&apos;entraînement par domaine, aux examens blancs et au suivi de votre
        progression.
      </EmailParagraph>
      <EmailParagraph
        style={{ margin: "0 0 8px", color: emailTheme.colors.ink }}
      >
        Pour bien commencer&nbsp;:
      </EmailParagraph>
      <EmailSteps
        items={[
          <>
            <a href={`${dashboardUrl}/profil`} target="_blank" style={link}>
              Complétez votre profil
            </a>{" "}
            pour personnaliser votre espace.
          </>,
          <>
            <a
              href={`${dashboardUrl}/entrainement`}
              target="_blank"
              style={link}
            >
              Lancez un premier entraînement
            </a>{" "}
            sur le domaine de votre choix.
          </>,
          <>
            <a
              href={`${dashboardUrl}/examen-blanc`}
              target="_blank"
              style={link}
            >
              Découvrez les examens blancs
            </a>{" "}
            chronométrés, dans les conditions de l&apos;EACMC.
          </>,
        ]}
      />
      <EmailButton href={dashboardUrl}>
        Accéder à mon tableau de bord
      </EmailButton>
      <EmailFallbackLink href={dashboardUrl} />
    </EmailLayout>
  )
}
