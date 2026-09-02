import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

const row = { fontSize: "14px", color: "#18181b", margin: "4px 0" } as const

export type GrantedAccessLine = { label: string; expiresAtLabel: string }

export function PurchaseConfirmationEmail({
  productName,
  amountLabel,
  presentmentLabel,
  purchasedAtLabel,
  grantedAccess,
  accountUrl,
  supportEmail,
}: {
  productName: string
  amountLabel: string
  presentmentLabel: string | null
  purchasedAtLabel: string
  grantedAccess: GrantedAccessLine[]
  accountUrl: string
  supportEmail: string | null
}) {
  return (
    <EmailLayout preview={`Votre achat : ${productName}`}>
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Merci pour votre achat. Voici le récapitulatif de votre commande.
        </Text>
        <Text style={row}>
          <strong>Produit :</strong> {productName}
        </Text>
        <Text style={row}>
          <strong>Montant :</strong> {amountLabel}
          {presentmentLabel ? ` (soit environ ${presentmentLabel})` : ""}
        </Text>
        <Text style={row}>
          <strong>Date :</strong> {purchasedAtLabel}
        </Text>
        {grantedAccess.map((access) => (
          <Text key={access.label} style={row}>
            <strong>{access.label} :</strong> valide jusqu&apos;au{" "}
            {access.expiresAtLabel}
          </Text>
        ))}
        <Text style={{ fontSize: "13px", color: "#52525b", marginTop: "16px" }}>
          Cette transaction apparaîtra sous le libellé{" "}
          <strong>NOMAQBANQ</strong> sur votre relevé bancaire. Un reçu Stripe
          vous est envoyé séparément.
        </Text>
        <Button
          href={accountUrl}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Voir mes accès
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien : <Link href={accountUrl}>{accountUrl}</Link>
        </Text>
        {supportEmail ? (
          <Text style={{ fontSize: "13px", color: "#52525b" }}>
            Un souci avec cet achat ? Écrivez-nous à{" "}
            <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link> avant
            toute démarche auprès de votre banque.
          </Text>
        ) : null}
      </Section>
    </EmailLayout>
  )
}
