import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailLayout } from "./email-layout"

export function VerificationEmail({
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
      preview="Confirmez votre adresse courriel"
      heading="Confirmez votre adresse courriel"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Bienvenue ! Confirmez votre adresse courriel pour activer votre compte.
      </EmailParagraph>
      <EmailButton href={url}>Vérifier mon adresse</EmailButton>
      <EmailFallbackLink href={url} />
      <EmailParagraph muted>
        Ce lien expirera bientôt. Si vous n&apos;êtes pas à l&apos;origine de
        cette demande, ignorez ce message.
      </EmailParagraph>
    </EmailLayout>
  )
}
