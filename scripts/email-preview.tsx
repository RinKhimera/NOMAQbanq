/**
 * Rend chaque courriel avec des données d'exemple, en HTML et en texte brut,
 * dans `.email-preview/` (ignoré par git) pour les ouvrir dans un navigateur.
 * Une entrée par variante de la maquette. Aucun envoi, aucun serveur.
 *
 * Usage : bun run email:preview
 */
import { render } from "@react-email/render"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ReactElement } from "react"
import { AbandonedCartEmail } from "@/email/templates/abandoned-cart-email"
import { AccessExpiringEmail } from "@/email/templates/access-expiring-email"
import { ExamResultsEmail } from "@/email/templates/exam-results-email"
import { InactivityReminderEmail } from "@/email/templates/inactivity-reminder-email"
import { PurchaseConfirmationEmail } from "@/email/templates/purchase-confirmation-email"
import { ResetPasswordEmail } from "@/email/templates/reset-password-email"
import { VerificationEmail } from "@/email/templates/verification-email"
import { WelcomeEmail } from "@/email/templates/welcome-email"
import { formatCurrency, formatPresentmentAmount } from "@/lib/format"

// Origine de prod : le logo et les liens doivent résoudre depuis un navigateur.
const baseUrl = "https://nomaqbanq.ca"
const common = { firstName: "Samuel", baseUrl }
const subscriptionsUrl = `${baseUrl}/tableau-de-bord/abonnements`
const unsubscribeUrl = `${baseUrl}/desabonnement?token=exemple`

// Catalogue réel : 200 $ CA pour 6 mois (180 jours), payés le 5 juin 2026,
// donc un accès jusqu'au 2 décembre 2026. 200 $ CA ≈ 82 000 FCFA.
const examPurchase = {
  productName: "Accès Examens - 6 mois",
  amountLabel: formatCurrency(20000, "CAD"),
  presentmentLabel: formatPresentmentAmount(82000, "XAF"),
  purchasedAtLabel: "5 juin 2026",
  grantedAccess: [
    { label: "Accès Examens", expiresAtLabel: "2 décembre 2026" },
  ],
  accountUrl: subscriptionsUrl,
  supportEmail: "support@nomaqbanq.ca",
}

const resultUrl = `${baseUrl}/tableau-de-bord/examen-blanc/exemple/resultats`

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
  bienvenue: <WelcomeEmail {...common} />,
  achat: <PurchaseConfirmationEmail {...common} {...examPurchase} />,
  "achat-premium": (
    <PurchaseConfirmationEmail
      {...common}
      {...examPurchase}
      productName="Pack Premium - 6 mois"
      amountLabel={formatCurrency(35000, "CAD")}
      presentmentLabel={null}
      grantedAccess={[
        { label: "Accès Examens", expiresAtLabel: "2 décembre 2026" },
        { label: "Accès Entraînement", expiresAtLabel: "2 décembre 2026" },
      ]}
    />
  ),
  "achat-sans-prenom": (
    <PurchaseConfirmationEmail
      {...examPurchase}
      baseUrl={baseUrl}
      firstName={null}
      presentmentLabel={null}
      supportEmail={null}
    />
  ),
  ...Object.fromEntries(
    (
      [
        ["examens", "exam"],
        ["entrainement", "training"],
      ] as const
    ).flatMap(([slug, accessType]) =>
      [5, 1].map((days) => [
        `acces-${slug}-${days}j`,
        <AccessExpiringEmail
          key={`${slug}-${days}`}
          {...common}
          accessType={accessType}
          daysRemaining={days}
          renewUrl={subscriptionsUrl}
        />,
      ]),
    ),
  ),
  "resultats-score": (
    <ExamResultsEmail
      {...common}
      examTitle="Examen blanc EB-26"
      score={78}
      resultUrl={resultUrl}
    />
  ),
  "resultats-retenu": (
    <ExamResultsEmail
      {...common}
      examTitle="Examen blanc EB-26"
      score={null}
      resultUrl={resultUrl}
    />
  ),
  inactivite: (
    <InactivityReminderEmail {...common} unsubscribeUrl={unsubscribeUrl} />
  ),
  "panier-abandonne": (
    <AbandonedCartEmail
      {...common}
      unsubscribeUrl={unsubscribeUrl}
      productName={examPurchase.productName}
      priceLabel={examPurchase.amountLabel}
    />
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
