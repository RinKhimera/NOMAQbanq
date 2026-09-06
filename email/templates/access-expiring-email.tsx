import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailNotice } from "../components/email-notice"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailLayout } from "./email-layout"

export function AccessExpiringEmail({
  accessType,
  daysRemaining,
  renewUrl,
  firstName,
  baseUrl,
}: {
  accessType: "exam" | "training"
  daysRemaining: number
  renewUrl: string
  firstName: string | null
  baseUrl: string
}) {
  const label = accessType === "exam" ? "aux examens" : "à l'entraînement"
  const delay = `${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`
  return (
    <EmailLayout
      category="transactional"
      preview={`Votre accès ${label} expire dans ${delay}`}
      heading={`Votre accès ${label} expire dans ${delay}`}
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailNotice variant="warning">
        Votre accès {label} prend fin dans <strong>{delay}</strong>. Passé ce
        délai, vous ne pourrez plus y accéder tant qu&apos;il n&apos;est pas
        renouvelé.
      </EmailNotice>
      <EmailParagraph>
        Renouvelez-le dès maintenant pour continuer votre préparation sans
        interruption : le temps restant s&apos;ajoute à votre nouvel accès.
      </EmailParagraph>
      <EmailButton href={renewUrl}>Renouveler mon accès</EmailButton>
      <EmailFallbackLink href={renewUrl} />
    </EmailLayout>
  )
}
