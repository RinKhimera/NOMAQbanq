import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailNotice } from "../components/email-notice"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailRecap } from "../components/email-recap"
import { emailTheme } from "../theme"
import { EmailLayout } from "./email-layout"

export type GrantedAccessLine = { label: string; expiresAtLabel: string }

// Une échéance n'entre dans l'aperçu que si elle vaut pour tous les accès
// octroyés : un Pack Premium peut laisser un accès existant plus long.
const previewOf = (grantedAccess: GrantedAccessLine[]) => {
  const dates = new Set(grantedAccess.map((a) => a.expiresAtLabel))
  const [only] = dates
  return dates.size === 1
    ? `Votre accès est activé jusqu'au ${only}. Récapitulatif de votre commande.`
    : "Votre accès est activé. Récapitulatif de votre commande."
}

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
      preview={previewOf(grantedAccess)}
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
            mono: true,
          },
          { label: "Date", value: purchasedAtLabel },
          ...grantedAccess.map((access) => ({
            label: access.label,
            value: `jusqu'au ${access.expiresAtLabel}`,
          })),
        ]}
      />
      <EmailNotice variant="info">
        Cette transaction apparaîtra sous le libellé{" "}
        <span style={{ fontWeight: 600 }}>NOMAQBANQ</span> sur votre relevé
        bancaire. Un reçu Stripe vous est envoyé séparément.
      </EmailNotice>
      <EmailButton href={accountUrl}>Voir mes accès</EmailButton>
      <EmailFallbackLink href={accountUrl} />
      {supportEmail ? (
        <EmailParagraph muted style={{ margin: 0 }}>
          Une question sur cet achat&nbsp;? Écrivez-nous à{" "}
          <a
            href={`mailto:${supportEmail}`}
            style={{
              color: emailTheme.colors.accent,
              textDecoration: "underline",
            }}
          >
            {supportEmail}
          </a>{" "}
          avant toute démarche auprès de votre banque&nbsp;: nous réglons la
          plupart des demandes le jour même.
        </EmailParagraph>
      ) : null}
    </EmailLayout>
  )
}
