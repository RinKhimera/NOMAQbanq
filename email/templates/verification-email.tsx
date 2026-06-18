import { Button, Link, Section, Text } from "@react-email/components"

import { EmailLayout } from "./email-layout"

export function VerificationEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Confirmez votre adresse courriel">
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Bienvenue ! Confirmez votre adresse courriel pour activer votre compte.
        </Text>
        <Button
          href={url}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Vérifier mon adresse
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien dans votre navigateur : <Link href={url}>{url}</Link>
        </Text>
        <Text style={{ fontSize: "13px", color: "#71717a" }}>
          Ce lien expirera bientôt. Si vous n&apos;êtes pas à l&apos;origine de cette
          demande, ignorez ce message.
        </Text>
      </Section>
    </EmailLayout>
  )
}
