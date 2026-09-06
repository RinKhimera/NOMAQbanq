import { Link } from "@react-email/components"
import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailNotice } from "../components/email-notice"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailRecap } from "../components/email-recap"
import { emailTheme } from "../theme"
import { EmailLayout } from "./email-layout"

export type GrantedAccessLine = { label: string; expiresAtLabel: string }

export function PurchaseConfirmationEmail({
  productName,
  amountLabel,
  presentmentLabel,
  purchasedAtLabel,
  grantedAccess,
  accountUrl,
  supportEmail,
  firstName,
  baseUrl,
}: {
  productName: string
  amountLabel: string
  presentmentLabel: string | null
  purchasedAtLabel: string
  grantedAccess: GrantedAccessLine[]
  accountUrl: string
  supportEmail: string | null
  firstName: string | null
  baseUrl: string
}) {
  return (
    <EmailLayout
      category="transactional"
      preview={`Votre achat : ${productName}`}
      heading="Merci pour votre achat"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Votre accès est activé. Voici le récapitulatif de votre commande.
      </EmailParagraph>
      <EmailRecap
        rows={[
          { label: "Produit", value: productName },
          {
            label: "Montant",
            value: amountLabel,
            sub: presentmentLabel ? `soit environ ${presentmentLabel}` : null,
          },
          { label: "Date", value: purchasedAtLabel },
          ...grantedAccess.map((access) => ({
            label: access.label,
            value: `jusqu'au ${access.expiresAtLabel}`,
          })),
        ]}
      />
      <EmailNotice variant="info">
        Cette transaction apparaîtra sous le libellé <strong>NOMAQBANQ</strong>{" "}
        sur votre relevé bancaire. Un reçu Stripe vous est envoyé séparément.
      </EmailNotice>
      <EmailButton href={accountUrl}>Voir mes accès</EmailButton>
      <EmailFallbackLink href={accountUrl} />
      {supportEmail ? (
        <EmailParagraph muted>
          Une question sur cet achat ? Écrivez-nous à{" "}
          <Link
            href={`mailto:${supportEmail}`}
            style={{ color: emailTheme.colors.accent }}
          >
            {supportEmail}
          </Link>{" "}
          avant toute démarche auprès de votre banque : nous réglons la plupart
          des demandes le jour même.
        </EmailParagraph>
      ) : null}
    </EmailLayout>
  )
}
