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
      preview="Aucun accès n'a été activé. Reprenez votre achat quand vous le souhaitez."
      heading="Votre commande n'a pas été finalisée"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Votre paiement n&apos;a pas été complété, votre accès n&apos;a donc pas
        été activé. Voici ce que vous aviez choisi&nbsp;:
      </EmailParagraph>
      <EmailRecap
        rows={[
          { label: "Produit", value: productName },
          { label: "Prix", value: priceLabel, mono: true },
        ]}
      />
      <EmailButton href={pricingUrl}>Reprendre mon achat</EmailButton>
      <EmailFallbackLink href={pricingUrl} />
      <EmailParagraph muted style={{ margin: 0 }}>
        Si vous avez changé d&apos;avis, ignorez simplement ce courriel.
      </EmailParagraph>
    </EmailLayout>
  )
}
