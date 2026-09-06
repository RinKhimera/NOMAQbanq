import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailLayout } from "./email-layout"

export function ResetPasswordEmail({
  url,
  firstName,
  baseUrl,
}: {
  url: string
  firstName: string | null
  baseUrl: string
}) {
  return (
    <EmailLayout
      category="transactional"
      preview="Réinitialisation de votre mot de passe"
      heading="Réinitialisez votre mot de passe"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Vous avez demandé à réinitialiser votre mot de passe. Cliquez ci-dessous
        pour en choisir un nouveau.
      </EmailParagraph>
      <EmailButton href={url}>Réinitialiser mon mot de passe</EmailButton>
      <EmailFallbackLink href={url} />
      <EmailParagraph muted>
        Ce lien expirera bientôt. Si vous n&apos;êtes pas à l&apos;origine de
        cette demande, ignorez ce message ; votre mot de passe reste inchangé.
      </EmailParagraph>
    </EmailLayout>
  )
}
