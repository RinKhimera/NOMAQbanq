import { Button, Link, Section, Text } from "@react-email/components"

import { EmailLayout } from "./email-layout"

export function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Réinitialisation de votre mot de passe">
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Vous avez demandé à réinitialiser votre mot de passe. Cliquez ci-dessous pour
          en choisir un nouveau.
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
          Réinitialiser mon mot de passe
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien dans votre navigateur : <Link href={url}>{url}</Link>
        </Text>
        <Text style={{ fontSize: "13px", color: "#71717a" }}>
          Ce lien expirera bientôt. Si vous n&apos;êtes pas à l&apos;origine de cette
          demande, ignorez ce message ; votre mot de passe reste inchangé.
        </Text>
      </Section>
    </EmailLayout>
  )
}
