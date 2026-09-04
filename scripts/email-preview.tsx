/**
 * Rend chaque courriel avec des données d'exemple, en HTML et en texte brut,
 * dans `.email-preview/` (ignoré par git) pour les ouvrir dans un navigateur.
 * Aucun envoi, aucun serveur.
 *
 * Usage : bun run email:preview
 */
import { render } from "@react-email/render"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ReactElement } from "react"
import { EmailParagraph } from "@/email/components/email-paragraph"
import { AccessExpiringEmail } from "@/email/templates/access-expiring-email"
import { EmailLayout } from "@/email/templates/email-layout"
import { ExamResultsEmail } from "@/email/templates/exam-results-email"
import { PurchaseConfirmationEmail } from "@/email/templates/purchase-confirmation-email"
import { ResetPasswordEmail } from "@/email/templates/reset-password-email"
import { VerificationEmail } from "@/email/templates/verification-email"

// Origine de prod : le logo et les liens doivent résoudre depuis un navigateur.
const baseUrl = "https://nomaqbanq.ca"
const common = { firstName: "Samuel", baseUrl }

const samples: Record<string, ReactElement> = {
  verification: (
    <VerificationEmail
      {...common}
      url={`${baseUrl}/api/auth/verify-email?token=exemple`}
    />
  ),
  "mot-de-passe": (
    <ResetPasswordEmail
      {...common}
      url={`${baseUrl}/reinitialiser-mot-de-passe?token=exemple`}
    />
  ),
  resultats: (
    <ExamResultsEmail
      {...common}
      examTitle="Examen blanc no 3 — Médecine interne"
      score={78}
      resultUrl={`${baseUrl}/tableau-de-bord/examen-blanc/exemple/resultats`}
    />
  ),
  "acces-expirant": (
    <AccessExpiringEmail
      {...common}
      accessType="exam"
      daysRemaining={5}
      renewUrl={`${baseUrl}/tableau-de-bord/abonnements`}
    />
  ),
  achat: (
    <PurchaseConfirmationEmail
      {...common}
      productName="Accès aux examens — 90 jours"
      amountLabel="200,00 $"
      presentmentLabel="228 000 FCFA"
      purchasedAtLabel="3 septembre 2026"
      grantedAccess={[
        { label: "Accès aux examens", expiresAtLabel: "2 décembre 2026" },
      ]}
      accountUrl={`${baseUrl}/tableau-de-bord/abonnements`}
      supportEmail="support@nomaqbanq.ca"
    />
  ),
  "achat-sans-prenom": (
    <PurchaseConfirmationEmail
      baseUrl={baseUrl}
      firstName={null}
      productName="Accès premium — 180 jours"
      amountLabel="350,00 $"
      presentmentLabel={null}
      purchasedAtLabel="3 septembre 2026"
      grantedAccess={[
        { label: "Accès aux examens", expiresAtLabel: "2 mars 2027" },
        { label: "Accès à l'entraînement", expiresAtLabel: "2 mars 2027" },
      ]}
      accountUrl={`${baseUrl}/tableau-de-bord/abonnements`}
      supportEmail={null}
    />
  ),
  "commercial-exemple": (
    <EmailLayout
      {...common}
      category="commercial"
      unsubscribeUrl={`${baseUrl}/desabonnement?token=exemple`}
      preview="Exemple de courriel commercial"
      heading="Exemple de courriel commercial"
    >
      <EmailParagraph>
        Ce gabarit montre le pied de page avec désabonnement, réservé aux
        relances.
      </EmailParagraph>
    </EmailLayout>
  ),
}

const outDir = join(process.cwd(), ".email-preview")
await mkdir(outDir, { recursive: true })

for (const [name, element] of Object.entries(samples)) {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  await writeFile(join(outDir, `${name}.html`), html)
  await writeFile(join(outDir, `${name}.txt`), text)
  console.log(`✓ ${name}`)
}
console.log(`\n${Object.keys(samples).length} courriels rendus dans ${outDir}`)
