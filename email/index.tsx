import { getBaseUrl } from "@/lib/base-url"
import { env } from "@/lib/env/server"
import {
  formatCurrency,
  formatExpiration,
  formatPresentmentAmount,
} from "@/lib/format"
import { sendEmail } from "./send"
import { AccessExpiringEmail } from "./templates/access-expiring-email"
import { ExamResultsEmail } from "./templates/exam-results-email"
import { PurchaseConfirmationEmail } from "./templates/purchase-confirmation-email"
import { ResetPasswordEmail } from "./templates/reset-password-email"
import { VerificationEmail } from "./templates/verification-email"

export function sendVerificationEmail({
  to,
  url,
}: {
  to: string
  url: string
}) {
  return sendEmail({
    to,
    subject: "Vérifiez votre adresse courriel — NOMAQbanq",
    react: <VerificationEmail url={url} />,
  })
}

export function sendResetPassword({ to, url }: { to: string; url: string }) {
  return sendEmail({
    to,
    subject: "Réinitialisation de votre mot de passe — NOMAQbanq",
    react: <ResetPasswordEmail url={url} />,
  })
}

export function sendExamResultsEmail({
  to,
  examTitle,
  score,
  resultUrl,
}: {
  to: string
  examTitle: string
  score: number
  resultUrl: string
}) {
  return sendEmail({
    to,
    subject: `Résultats disponibles : ${examTitle} — NOMAQbanq`,
    react: (
      <ExamResultsEmail
        examTitle={examTitle}
        score={score}
        resultUrl={resultUrl}
      />
    ),
  })
}

export function sendAccessExpiringEmail({
  to,
  accessType,
  daysRemaining,
  renewUrl,
}: {
  to: string
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
  productName,
  amountPaid,
  currency,
  presentmentAmount,
  presentmentCurrency,
  purchasedAt,
  grantedAccess,
}: {
  to: string
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
        accountUrl={`${getBaseUrl()}/tableau-de-bord/abonnements`}
        supportEmail={env.SUPPORT_EMAIL ?? null}
      />
    ),
  })
}
