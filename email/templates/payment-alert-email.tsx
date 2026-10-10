import { Link } from "@react-email/components"
import { EmailButton } from "../components/email-button"
import { EmailNotice } from "../components/email-notice"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailRecap } from "../components/email-recap"
import type { PaymentAlertContent } from "../payment-alert"
import { emailTheme } from "../theme"
import { EmailLayout } from "./email-layout"

const { colors, fonts, tones } = emailTheme

/** Chiffres mis en avant (montant contesté, date limite), côte à côte. */
function AlertFigures({ items }: { items: PaymentAlertContent["figures"] }) {
  if (items.length === 0) return null
  const cell = {
    padding: "14px 16px",
    verticalAlign: "top",
    backgroundColor: tones.danger.background,
    border: `1px solid ${tones.danger.line}`,
    width: `${100 / items.length}%`,
  } as const
  return (
    <table
      role="presentation"
      data-text-format="dataTable"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{ borderCollapse: "collapse", margin: "0 0 20px" }}
    >
      <tbody>
        <tr>
          {items.map((item) => (
            <td key={item.label} style={cell}>
              <span
                style={{
                  display: "block",
                  fontFamily: fonts.mono,
                  fontSize: "11px",
                  lineHeight: "16px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: colors.ink2,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "4px",
                  fontFamily: fonts.mono,
                  fontSize: "20px",
                  lineHeight: "26px",
                  fontWeight: 600,
                  color: colors.ink,
                }}
              >
                {item.value}
              </span>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

export function PaymentAlertEmail({
  content,
  profileUrl,
  firstName,
  baseUrl,
}: {
  content: PaymentAlertContent
  /** Section Notifications du profil admin, où se refusent les alertes. */
  profileUrl: string
  firstName: string | null
  baseUrl: string
}) {
  return (
    <EmailLayout
      category="transactional"
      preview={content.preview}
      heading={content.heading}
      firstName={firstName}
      baseUrl={baseUrl}
      footerNote={
        <>
          Vous recevez ce courriel parce que les alertes de paiement sont
          activées dans votre profil.{" "}
          <Link
            href={profileUrl}
            style={{ color: colors.ink3, textDecoration: "underline" }}
          >
            Gérer les alertes dans mon profil
          </Link>
        </>
      }
    >
      <EmailParagraph>{content.intro}</EmailParagraph>
      <AlertFigures items={content.figures} />
      {content.notice ? (
        <EmailNotice variant={content.notice.tone}>
          {content.notice.text}
        </EmailNotice>
      ) : null}
      <EmailRecap rows={content.rows} />
      {content.advice ? (
        <EmailParagraph>{content.advice}</EmailParagraph>
      ) : null}
      <EmailButton href={content.button.href}>
        {content.button.label}
      </EmailButton>
    </EmailLayout>
  )
}
