import * as z from "zod"

export const productCodeSchema = z.enum([
  "exam_access",
  "training_access",
  "exam_access_promo",
  "training_access_promo",
  "premium_access",
])

export type ProductCode = z.infer<typeof productCodeSchema>

export const accessTypeSchema = z.enum(["exam", "training"])

export type AccessType = z.infer<typeof accessTypeSchema>

export const transactionStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "refunded",
])

export type TransactionStatus = z.infer<typeof transactionStatusSchema>

export const transactionTypeSchema = z.enum(["stripe", "manual"])

export type TransactionType = z.infer<typeof transactionTypeSchema>

export const paymentMethodSchema = z.enum([
  "cash",
  "interac",
  "virement",
  "autre",
])

export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Espèces",
  interac: "Interac",
  virement: "Virement bancaire",
  autre: "Autre",
}

/** Libellé d'un moyen de paiement manuel ; une valeur hors liste s'affiche telle quelle. */
export const paymentMethodLabel = (method: string): string =>
  method in PAYMENT_METHOD_LABEL
    ? PAYMENT_METHOD_LABEL[method as PaymentMethod]
    : method

export const MANUAL_NOTE_MAX = 500
export const FREE_REASON_MIN = 5

/**
 * Règle de la note d'un paiement manuel. Un accès offert (montant nul) n'a pas
 * de moyen de paiement : la note en devient le motif, obligatoire.
 */
export const manualNoteError = (note: string, free: boolean): string | null => {
  if (note.length > MANUAL_NOTE_MAX) return "500 caractères au plus."
  if (free && note.trim().length < FREE_REASON_MIN)
    return "Indiquez le motif de la gratuité (5 caractères au moins)."
  return null
}

// Types pour les accès utilisateur
export interface AccessInfo {
  expiresAt: number
  daysRemaining: number
}

export interface MyAccessStatus {
  examAccess: AccessInfo | null
  trainingAccess: AccessInfo | null
}
