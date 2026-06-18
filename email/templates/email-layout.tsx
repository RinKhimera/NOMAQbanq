import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"

export function EmailLayout({
  preview,
  children,
}: {
  preview: string
  children: ReactNode
}) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ margin: "0 auto", maxWidth: "480px", padding: "24px" }}>
          <Section>
            <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#18181b" }}>
              NOMAQbanq
            </Text>
          </Section>
          {children}
          <Hr style={{ borderColor: "#e4e4e7", margin: "24px 0" }} />
          <Text style={{ fontSize: "12px", color: "#71717a" }}>
            NOMAQbanq — Préparation à l&apos;EACMC Partie I.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
