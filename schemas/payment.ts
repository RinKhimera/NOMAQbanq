import * as z from "zod"

export const productCodeSchema = z.enum([
  "exam_access",
  "training_access",
  "exam_access_promo",
  "training_access_promo",
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

export const manualPaymentSchema = z
  .object({
    userId: z.string().min(1, "L'utilisateur est requis"),
    productCode: productCodeSchema,
    amountInput: z.string().min(1, "Le montant est requis"),
    currency: z.enum(["CAD", "XAF"]),
    paymentMethod: paymentMethodSchema,
    notes: z
      .string()
      .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
      .optional(),
  })
  .refine(
    (data) => {
      const normalized = data.amountInput.replace(",", ".").trim()
      const num = parseFloat(normalized)

      if (isNaN(num) || num <= 0) return false

      if (data.currency === "XAF") {
        // XAF (FCFA) n'a pas de centimes - entiers uniquement
        return Number.isInteger(num)
      } else {
        // CAD permet jusqu'à 2 décimales
        const decimalPart = normalized.split(".")[1]
        const decimalPlaces = decimalPart ? decimalPart.length : 0
        return decimalPlaces <= 2
      }
    },
    {
      message: "Montant invalide pour la devise sélectionnée",
      path: ["amountInput"],
    }
  )

export type ManualPaymentFormValues = z.infer<typeof manualPaymentSchema>

export const editTransactionSchema = z
  .object({
    amountInput: z.string().min(1, "Le montant est requis"),
    currency: z.enum(["CAD", "XAF"]),
    paymentMethod: paymentMethodSchema,
    notes: z
      .string()
      .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
      .optional(),
    status: z.enum(["completed", "refunded"]).optional(),
  })
  .refine(
    (data) => {
      const normalized = data.amountInput.replace(",", ".").trim()
      const num = parseFloat(normalized)

      if (isNaN(num) || num <= 0) return false

      if (data.currency === "XAF") {
        // XAF (FCFA) n'a pas de centimes - entiers uniquement
        return Number.isInteger(num)
      } else {
        // CAD permet jusqu'à 2 décimales
        const decimalPart = normalized.split(".")[1]
        const decimalPlaces = decimalPart ? decimalPart.length : 0
        return decimalPlaces <= 2
      }
    },
    {
      message: "Montant invalide pour la devise sélectionnée",
      path: ["amountInput"],
    }
  )

export type EditTransactionFormValues = z.infer<typeof editTransactionSchema>

// Types pour les accès utilisateur
export interface AccessInfo {
  expiresAt: number
  daysRemaining: number
}

export interface MyAccessStatus {
  examAccess: AccessInfo | null
  trainingAccess: AccessInfo | null
}
