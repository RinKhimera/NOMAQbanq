import type { AccessType } from "@/features/payments/access-ledger"
import type { ManualGrant } from "@/features/payments/actions"
import type { ClientVerdict } from "@/features/payments/dal"
import { formatMediumDate, formatMediumDateTime } from "@/lib/format"
import type { Tone } from "@/lib/tone"
import { paymentMethodLabel } from "@/schemas/payment"
import { ACCESS_TYPE_LABEL } from "./access-badge"

// Règles d'affichage des transactions admin, sans état ni rendu : appelables
// d'un composant client comme d'un Server Component.

const DAY_MS = 24 * 60 * 60 * 1000
const NB = " "

/** Constat en une phrase du dossier d'un client, par priorité. */
export const verdictLine = (
  verdict: ClientVerdict,
): {
  tone: Extract<Tone, "danger" | "neutral" | "success" | "warning">
  text: string
} => {
  switch (verdict.kind) {
    case "dispute":
      return {
        tone: "danger",
        text: "Litige en cours sur un paiement Stripe. L'accès reste actif tant que le litige n'est pas perdu.",
      }
    case "failed": {
      const attempts =
        verdict.failedStreak > 1
          ? `${verdict.failedStreak} tentatives Stripe ont échoué`
          : "La dernière tentative Stripe a échoué"
      const never = verdict.everPaid ? "" : " ; le client n'a jamais payé"
      return {
        tone: "danger",
        text: `${attempts}, la dernière le ${formatMediumDateTime(verdict.lastFailedAt)}. Aucun paiement n'a abouti ensuite${never}.`,
      }
    }
    case "refunded":
      return {
        tone: "neutral",
        text: `Le dernier paiement a été remboursé le ${formatMediumDate(verdict.refundedAt)} ; l'accès correspondant a été retiré ou recalculé.`,
      }
    case "completed":
      return {
        tone: "success",
        text: `Le dernier paiement a abouti le ${formatMediumDateTime(verdict.completedAt)}${verdict.manual ? " (paiement manuel, aucun courriel envoyé)" : ""}.`,
      }
    case "pending":
      return {
        tone: "warning",
        text: `Un paiement Stripe est en attente depuis le ${formatMediumDateTime(verdict.createdAt)} ; l'accès sera accordé à sa confirmation.`,
      }
  }
}

/** « Stripe », « Manuel · Interac », « Manuel · Accès offert ». */
export const transactionTypeLabel = (t: {
  type: "stripe" | "manual"
  amountPaid: number
  paymentMethod: string | null
}): string => {
  if (t.type === "stripe") return "Stripe"
  if (t.amountPaid === 0) return "Manuel · Accès offert"
  return `Manuel · ${t.paymentMethod ? paymentMethodLabel(t.paymentMethod) : "—"}`
}

/** Accès couverts par une transaction : un combo porte les deux. */
export const coveredAccess = (t: {
  isCombo: boolean
  accessType: AccessType
}): AccessType[] => (t.isCombo ? ["exam", "training"] : [t.accessType])

/** « Examens + Entraînement · 180 jours ». */
export const grantedAccessLabel = (t: {
  isCombo: boolean
  accessType: AccessType
  durationDays: number
}): string =>
  `${coveredAccess(t)
    .map((a) => ACCESS_TYPE_LABEL[a])
    .join(" + ")} · ${t.durationDays} jours`

/**
 * État d'un accès lu dans `user_access` (échéance passée comprise). Sans
 * ligne, un paiement remboursé veut dire « retiré », pas « jamais acheté » :
 * le registre supprime la ligne quand plus rien ne couvre l'accès.
 */
export const accessLine = (
  expiresAt: number | null,
  now: number,
  refunded = false,
): { state: "active" | "expired" | "never"; text: string } => {
  if (expiresAt === null)
    return {
      state: "never",
      text: refunded ? "Retiré après remboursement" : "Jamais acheté",
    }
  if (expiresAt > now)
    return {
      state: "active",
      text: `Actif jusqu'au ${formatMediumDate(expiresAt)}`,
    }
  return { state: "expired", text: `Expiré le ${formatMediumDate(expiresAt)}` }
}

/**
 * Ligne « Accès accordé » après un paiement manuel. Un accès simple encore
 * actif est prolongé (jours restants + durée) ; le Pack Premium pose une
 * fenêtre neuve, sans addition : l'expiration vient toujours du registre.
 */
export const recordedGrantLine = (
  grant: ManualGrant,
  o: { isCombo: boolean; durationDays: number; recordedAt: number },
): string => {
  const until = formatMediumDate(grant.expiresAt)
  const previous = grant.previousExpiresAt
  if (o.isCombo || previous === null || previous <= o.recordedAt)
    return `accordé jusqu'au ${until}`
  const remaining = Math.ceil((previous - o.recordedAt) / DAY_MS)
  return `${remaining}${NB}j restants + ${o.durationDays}${NB}j = ${remaining + o.durationDays}${NB}j · prolongé jusqu'au ${until}`
}

/** Dossier d'un client sur la page Transactions, transaction dépliée. */
export const clientFileHref = (userId: string, transactionId?: string) => {
  const params = new URLSearchParams({ client: userId })
  if (transactionId) params.set("tx", transactionId)
  return `/admin/transactions?${params}`
}
