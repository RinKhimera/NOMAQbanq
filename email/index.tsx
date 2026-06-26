import { sendEmail } from "./send"
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
