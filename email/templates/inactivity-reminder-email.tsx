import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailLayout } from "./email-layout"

export function InactivityReminderEmail({
  firstName,
  baseUrl,
  unsubscribeUrl,
}: {
  firstName: string | null
  baseUrl: string
  unsubscribeUrl: string
}) {
  const trainingUrl = `${baseUrl}/tableau-de-bord/entrainement`
  return (
    <EmailLayout
      category="commercial"
      unsubscribeUrl={unsubscribeUrl}
      preview="Nous ne vous avons pas vu depuis quelques semaines"
      heading="Votre préparation vous attend"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Nous ne vous avons pas vu depuis quelques semaines. Votre espace est
        toujours là, avec votre progression intacte.
      </EmailParagraph>
      <EmailParagraph>
        Quelques questions par jour suffisent pour garder le rythme : la banque
        de questions par domaine pour cibler vos points faibles, et les examens
        blancs chronométrés pour vous mettre dans les conditions de
        l&apos;EACMC.
      </EmailParagraph>
      <EmailButton href={trainingUrl}>
        Reprendre l&apos;entraînement
      </EmailButton>
      <EmailFallbackLink href={trainingUrl} />
    </EmailLayout>
  )
}
