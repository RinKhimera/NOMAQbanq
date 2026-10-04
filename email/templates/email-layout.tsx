import { Body, Head, Html, Img, Link, Preview } from "@react-email/components"
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

const { colors, fonts, radius } = emailTheme

// Seule feuille de style du courriel : les styles en ligne ne connaissent pas
// la largeur d'écran. `!important` l'emporte sur eux ; Outlook bureau ignore la
// règle et garde la mise en page d'ordinateur, ce qui reste lisible.
const RESPONSIVE_CSS = `
@media only screen and (max-width: 479px) {
  .nq-shell { padding: 20px 12px 28px !important; }
  .nq-card { padding: 20px !important; }
  .nq-title { font-size: 24px !important; line-height: 30px !important; }
  .nq-btn { width: 100% !important; }
}
`

const footerText = {
  margin: "0 0 6px",
  fontFamily: fonts.sans,
  fontSize: "12px",
  lineHeight: "18px",
  color: colors.ink3,
} as const
const footerLink = { color: colors.ink3, textDecoration: "underline" } as const

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
        <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: colors.page }}>
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          width="100%"
          style={{ backgroundColor: colors.page }}
        >
          <tbody>
            <tr>
              <td className="nq-shell" style={{ padding: "32px 24px 40px" }}>
                <table
                  role="presentation"
                  align="center"
                  cellPadding={0}
                  cellSpacing={0}
                  width="100%"
                  style={{
                    maxWidth: `${emailTheme.cardWidth}px`,
                    margin: "0 auto",
                    // `separate` : en `collapse`, l'arrondi de la carte
                    // (bordure d'une cellule) n'est pas rendu.
                    borderCollapse: "separate",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "0 4px 16px" }}>
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          style={{ borderCollapse: "collapse" }}
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  paddingRight: "8px",
                                  verticalAlign: "middle",
                                }}
                              >
                                <Img
                                  src={emailBrand.logoUrl}
                                  alt=""
                                  width={24}
                                  height={24}
                                  style={{
                                    display: "block",
                                    borderRadius: radius.control,
                                  }}
                                />
                              </td>
                              <td
                                style={{
                                  verticalAlign: "middle",
                                  fontFamily: fonts.sans,
                                  fontSize: "17px",
                                  fontWeight: 600,
                                  lineHeight: "20px",
                                  letterSpacing: "-0.01em",
                                  color: colors.ink,
                                }}
                              >
                                NOMAQ
                                <span style={{ color: colors.accent }}>
                                  banq
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div
                          style={{
                            marginTop: "6px",
                            fontFamily: fonts.mono,
                            fontSize: "10px",
                            lineHeight: "14px",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: colors.ink3,
                          }}
                        >
                          {emailBrand.tagline}
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td
                        className="nq-card"
                        style={{
                          backgroundColor: colors.card,
                          border: `1px solid ${colors.line}`,
                          borderRadius: radius.card,
                          padding: "32px",
                        }}
                      >
                        <h1
                          className="nq-title"
                          style={{
                            margin: "0 0 20px",
                            fontFamily: fonts.serif,
                            fontSize: "26px",
                            lineHeight: "32px",
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                            color: colors.ink,
                          }}
                        >
                          {heading}
                        </h1>
                        {firstName ? (
                          <p
                            style={{
                              margin: "0 0 16px",
                              fontFamily: fonts.sans,
                              fontSize: "16px",
                              lineHeight: "26px",
                              color: colors.ink,
                            }}
                          >
                            {/* Une seule expression : React insère `<!-- -->` entre
                                nœuds texte adjacents, ce qui casserait « Bonjour Samuel, ». */}
                            {`Bonjour ${firstName},`}
                          </p>
                        ) : null}
                        {children}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: "20px 4px 0" }}>
                        <p style={footerText}>
                          {`${emailBrand.name} · `}
                          {/* Ancre sans href : empêche Gmail et Apple Mail de
                              transformer l'adresse en lien bleu souligné. */}
                          <a
                            style={{
                              color: colors.ink3,
                              textDecoration: "none",
                            }}
                          >
                            {emailBrand.postalAddress}
                          </a>
                        </p>
                        <p style={{ ...footerText, margin: 0 }}>
                          <Link
                            href={absolute(emailBrand.links.help)}
                            style={footerLink}
                          >
                            Aide
                          </Link>
                          {" · "}
                          <Link
                            href={absolute(emailBrand.links.terms)}
                            style={footerLink}
                          >
                            Conditions
                          </Link>
                          {" · "}
                          <Link
                            href={absolute(emailBrand.links.privacy)}
                            style={footerLink}
                          >
                            Confidentialité
                          </Link>
                        </p>
                        {category === "commercial" ? (
                          <p
                            style={{
                              ...footerText,
                              margin: "14px 0 0",
                              paddingTop: "14px",
                              borderTop: `1px solid ${colors.line}`,
                            }}
                          >
                            Vous recevez ce courriel parce que vous avez un
                            compte {emailBrand.name}.{" "}
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
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  )
}
