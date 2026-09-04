import { getBaseUrl } from "@/lib/base-url"
import { env } from "@/lib/env/server"
import {
  formatCurrency,
  formatExpiration,
  formatPresentmentAmount,
} from "@/lib/format"
import { firstNameOf } from "./first-name"
import { sendEmail } from "./send"
import { AccessExpiringEmail } from "./templates/access-expiring-email"
import { ExamResultsEmail } from "./templates/exam-results-email"
import { PurchaseConfirmationEmail } from "./templates/purchase-confirmation-email"
import { ResetPasswordEmail } from "./templates/reset-password-email"
import { VerificationEmail } from "./templates/verification-email"

/** Nom complet du destinataire tel qu'en base ; le prénom en est extrait ici. */
type Recipient = { to: string; name?: string | null }

const layoutProps = (name: string | null | undefined) => ({
  firstName: firstNameOf(name),
  baseUrl: getBaseUrl(),
})

export function sendVerificationEmail({
  to,
  name,
  url,
}: Recipient & { url: string }) {
  return sendEmail({
    to,
    subject: "Vérifiez votre adresse courriel — NOMAQbanq",
    react: <VerificationEmail url={url} {...layoutProps(name)} />,
  })
}

export function sendResetPassword({
  to,
  name,
  url,
}: Recipient & { url: string }) {
  return sendEmail({
    to,
    subject: "Réinitialisation de votre mot de passe — NOMAQbanq",
    react: <ResetPasswordEmail url={url} {...layoutProps(name)} />,
  })
}

export function sendExamResultsEmail({
  to,
  name,
  examTitle,
  score,
  resultUrl,
}: Recipient & { examTitle: string; score: number; resultUrl: string }) {
  return sendEmail({
    to,
    subject: `Résultats disponibles : ${examTitle} — NOMAQbanq`,
    react: (
      <ExamResultsEmail
        examTitle={examTitle}
        score={score}
        resultUrl={resultUrl}
        {...layoutProps(name)}
      />
    ),
  })
}

export function sendAccessExpiringEmail({
  to,
  name,
  accessType,
  daysRemaining,
  renewUrl,
}: Recipient & {
  accessType: "exam" | "training"
  daysRemaining: number
  renewUrl: string
}) {
  const label = accessType === "exam" ? "aux examens" : "à l'entraînement"
  return sendEmail({
    to,
    subject: `Votre accès ${label} expire bientôt — NOMAQbanq`,
    react: (
      <AccessExpiringEmail
        accessType={accessType}
        daysRemaining={daysRemaining}
        renewUrl={renewUrl}
        {...layoutProps(name)}
      />
    ),
  })
}

const ACCESS_LABEL = {
  exam: "Accès aux examens",
  training: "Accès à l'entraînement",
} as const

export function sendPurchaseConfirmationEmail({
  to,
  name,
  productName,
  amountPaid,
  currency,
  presentmentAmount,
  presentmentCurrency,
  purchasedAt,
  grantedAccess,
}: Recipient & {
  productName: string
  /** Centièmes, devise d'encaissement. */
  amountPaid: number
  currency: "CAD" | "XAF"
  /** Unités mineures de la devise locale (Adaptive Pricing), null sans conversion. */
  presentmentAmount: number | null
  presentmentCurrency: string | null
  purchasedAt: Date
  /** Expirations EFFECTIVES écrites par le fulfillment, une par type octroyé. */
  grantedAccess: { accessType: "exam" | "training"; expiresAt: Date }[]
}) {
  const presentmentLabel =
    presentmentAmount != null && presentmentCurrency
      ? formatPresentmentAmount(presentmentAmount, presentmentCurrency)
      : null
  // Sans adresse de support, l'invitation à écrire avant toute démarche
  // bancaire — la seule phrase préventive du courriel — disparaît : signaler.
  if (!env.SUPPORT_EMAIL) {
    console.warn(
      "[email] SUPPORT_EMAIL absente : courriel de confirmation envoyé sans adresse de support",
    )
  }
  const { baseUrl, firstName } = layoutProps(name)
  return sendEmail({
    to,
    subject: "Confirmation de votre achat — NOMAQbanq",
    react: (
      <PurchaseConfirmationEmail
        productName={productName}
        amountLabel={formatCurrency(amountPaid, currency)}
        presentmentLabel={presentmentLabel}
        purchasedAtLabel={formatExpiration(purchasedAt.getTime())}
        grantedAccess={grantedAccess.map((a) => ({
          label: ACCESS_LABEL[a.accessType],
          expiresAtLabel: formatExpiration(a.expiresAt.getTime()),
        }))}
        accountUrl={`${baseUrl}/tableau-de-bord/abonnements`}
        supportEmail={env.SUPPORT_EMAIL ?? null}
        firstName={firstName}
        baseUrl={baseUrl}
      />
    ),
  })
}
