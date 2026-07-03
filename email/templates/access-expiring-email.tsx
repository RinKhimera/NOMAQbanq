import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

export function AccessExpiringEmail({
  accessType,
  daysRemaining,
  renewUrl,
}: {
  accessType: "exam" | "training"
  daysRemaining: number
  renewUrl: string
}) {
  const label = accessType === "exam" ? "aux examens" : "à l'entraînement"
  return (
    <EmailLayout preview={`Votre accès ${label} expire bientôt`}>
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Votre accès {label} expire dans{" "}
          <strong>{daysRemaining} jour(s)</strong>. Renouvelez-le pour continuer
          votre préparation sans interruption.
        </Text>
        <Button
          href={renewUrl}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Renouveler mon accès
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien : <Link href={renewUrl}>{renewUrl}</Link>
        </Text>
      </Section>
    </EmailLayout>
  )
}
