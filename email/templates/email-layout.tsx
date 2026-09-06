import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"
import { emailBrand, emailTheme } from "../theme"

export type EmailCategory = "transactional" | "commercial"

// Un courriel commercial (Loi canadienne anti-pourriel) porte obligatoirement
// un lien de désabonnement ; un transactionnel n'en porte jamais. Le type
// discriminé rend les deux erreurs impossibles à la compilation.
type CategoryProps =
  | { category: "transactional"; unsubscribeUrl?: never }
  | { category: "commercial"; unsubscribeUrl: string }

export type EmailLayoutProps = {
  preview: string
  heading: string
  firstName?: string | null
  /** Origine absolue de l'app (logo, liens). Les templates ne lisent jamais l'env. */
  baseUrl: string
  children: ReactNode
} & CategoryProps

const { colors, fontFamily, radius } = emailTheme

const footerText = {
  fontFamily,
  fontSize: "12.5px",
  lineHeight: "1.6",
  color: colors.footer,
  margin: "0 0 6px",
} as const
const footerLink = {
  color: colors.footer,
  textDecoration: "underline",
} as const
const separator = { color: "#c3cad6" } as const

export function EmailLayout({
  preview,
  heading,
  firstName,
  baseUrl,
  category,
  unsubscribeUrl,
  children,
}: EmailLayoutProps) {
  const absolute = (path: string) => `${baseUrl}${path}`
  return (
    <Html lang="fr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: colors.page, fontFamily }}>
        <Container
          style={{
            maxWidth: `${emailTheme.cardWidth}px`,
            margin: "0 auto",
            padding: "24px 8px",
          }}
        >
          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.card,
            }}
          >
            {/* Filet dégradé en cellule de tableau : Outlook bureau (moteur Word)
                ignore `height` sur un div vide mais honore `height` et
                `background-color` sur un td, d'où un aplat bleu à défaut du
                dégradé. */}
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              width="100%"
            >
              <tbody>
                <tr>
                  <td
                    height={4}
                    style={{
                      height: "4px",
                      fontSize: 0,
                      lineHeight: 0,
                      backgroundColor: colors.accent,
                      backgroundImage: `linear-gradient(90deg, ${colors.accent}, ${colors.accentEnd})`,
                      borderRadius: `${radius.card} ${radius.card} 0 0`,
                    }}
                  >
                    &nbsp;
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              style={{ margin: "22px 28px 0" }}
            >
              <tbody>
                <tr>
                  <td style={{ width: "52px", verticalAlign: "middle" }}>
                    <Img
                      src={emailBrand.logoUrl}
                      alt={emailBrand.name}
                      width={40}
                      height={40}
                      style={{ display: "block", borderRadius: "9px" }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <div
                      style={{
                        fontFamily,
                        fontSize: "19px",
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        lineHeight: "1.2",
                      }}
                    >
                      <span style={{ color: colors.accent }}>NOMAQ</span>
                      <span style={{ color: colors.text }}>banq</span>
                    </div>
                    <div
                      style={{
                        fontFamily,
                        fontSize: "12px",
                        color: colors.muted,
                      }}
                    >
                      {emailBrand.tagline}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <Section style={{ padding: "22px 28px 8px" }}>
              <Text
                style={{
                  fontFamily,
                  fontSize: "21px",
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  lineHeight: "1.3",
                  color: colors.text,
                  margin: "0 0 10px",
                }}
              >
                {heading}
              </Text>
              {firstName ? (
                <Text
                  style={{
                    fontFamily,
                    fontSize: "15px",
                    lineHeight: "1.55",
                    color: colors.text,
                    margin: "0 0 12px",
                  }}
                >
                  {/* Une seule expression : React insère `<!-- -->` entre
                      nœuds texte adjacents, ce qui casserait « Bonjour Samuel, ». */}
                  {`Bonjour ${firstName},`}
                </Text>
              ) : null}
              {children}
            </Section>

            <Section
              style={{
                borderTop: `1px solid ${colors.divider}`,
                padding: "18px 28px 24px",
                textAlign: "center",
              }}
            >
              <Text style={footerText}>
                {emailBrand.name} ·{" "}
                {/* Ancre sans href : empêche Gmail et Apple Mail de transformer
                    l'adresse en lien bleu souligné. */}
                <a style={{ color: colors.footer, textDecoration: "none" }}>
                  {emailBrand.postalAddress}
                </a>
              </Text>
              <Text style={footerText}>
                <Link href={absolute(emailBrand.links.help)} style={footerLink}>
                  Aide
                </Link>
                <span style={separator}> · </span>
                <Link
                  href={absolute(emailBrand.links.terms)}
                  style={footerLink}
                >
                  Conditions
                </Link>
                <span style={separator}> · </span>
                <Link
                  href={absolute(emailBrand.links.privacy)}
                  style={footerLink}
                >
                  Confidentialité
                </Link>
              </Text>
              {category === "commercial" ? (
                <Text
                  style={{
                    ...footerText,
                    borderTop: `1px solid ${colors.divider}`,
                    paddingTop: "10px",
                    marginTop: "10px",
                  }}
                >
                  Vous recevez ce courriel parce que vous avez un compte{" "}
                  {emailBrand.name}.{" "}
                  <Link href={unsubscribeUrl} style={footerLink}>
                    Ne plus recevoir ces rappels
                  </Link>{" "}
                  ou{" "}
                  <Link
                    href={absolute(emailBrand.links.preferences)}
                    style={footerLink}
                  >
                    gérer mes préférences
                  </Link>
                  .
                </Text>
              ) : null}
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
