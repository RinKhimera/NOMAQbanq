import { sendEmail } from "./send"
import { AccessExpiringEmail } from "./templates/access-expiring-email"
import { ExamResultsEmail } from "./templates/exam-results-email"
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
