import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailNotice } from "../components/email-notice"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailLayout } from "./email-layout"

type AccessType = "exam" | "training"

const ACCESS_LABEL = {
  exam: "aux examens",
  training: "à l'entraînement",
} as const

const delayOf = (days: number) => `${days} jour${days > 1 ? "s" : ""}`

/** Titre du courriel, repris tel quel en objet. */
export const accessExpiringTitle = (accessType: AccessType, days: number) =>
  `Votre accès ${ACCESS_LABEL[accessType]} expire dans ${delayOf(days)}`

export function AccessExpiringEmail({
  accessType,
  daysRemaining,
  renewUrl,
  firstName,
  baseUrl,
}: {
  accessType: AccessType
  daysRemaining: number
  renewUrl: string
  firstName: string | null
  baseUrl: string
}) {
  return (
    <EmailLayout
      category="transactional"
      preview={
        "Prolongez-le maintenant : le temps restant s'ajoute à votre nouvel accès."
      }
      heading={accessExpiringTitle(accessType, daysRemaining)}
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailNotice variant="warning">
        {`Votre accès ${ACCESS_LABEL[accessType]} prend fin dans ${delayOf(daysRemaining)}. `}
        Passé ce délai, vous ne pourrez plus y accéder tant qu&apos;il
        n&apos;est pas prolongé.
      </EmailNotice>
      <EmailParagraph>
        Prolongez-le dès maintenant pour continuer votre préparation sans
        interruption&nbsp;: le temps restant s&apos;ajoute à votre nouvel accès.
      </EmailParagraph>
      <EmailButton href={renewUrl}>Prolonger mon accès</EmailButton>
      <EmailFallbackLink href={renewUrl} />
    </EmailLayout>
  )
}
