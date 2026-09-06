import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailRecap } from "../components/email-recap"
import { EmailLayout } from "./email-layout"

export function AbandonedCartEmail({
  firstName,
  baseUrl,
  unsubscribeUrl,
  productName,
  priceLabel,
}: {
  firstName: string | null
  baseUrl: string
  unsubscribeUrl: string
  productName: string
  priceLabel: string
}) {
  const pricingUrl = `${baseUrl}/tarifs`
  return (
    <EmailLayout
      category="commercial"
      unsubscribeUrl={unsubscribeUrl}
      preview={`Votre commande ${productName} n'a pas été finalisée`}
      heading="Votre commande n'a pas été finalisée"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Votre paiement n&apos;a pas été complété, votre accès n&apos;a donc pas
        été activé. Voici ce que vous aviez choisi :
      </EmailParagraph>
      <EmailRecap
        rows={[
          { label: "Produit", value: productName },
          { label: "Prix", value: priceLabel },
        ]}
      />
      <EmailParagraph>
        Cet accès débloque l&apos;ensemble des questions du domaine et les
        examens blancs correspondants, avec le suivi de votre progression.
      </EmailParagraph>
      <EmailButton href={pricingUrl}>Reprendre mon achat</EmailButton>
      <EmailFallbackLink href={pricingUrl} />
      <EmailParagraph muted>
        Si vous avez changé d&apos;avis, ignorez simplement ce courriel.
      </EmailParagraph>
    </EmailLayout>
  )
}
