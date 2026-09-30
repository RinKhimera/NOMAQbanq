import { z } from "zod"
import { currency, productCode } from "@/db/schema"
import { MANUAL_NOTE_MAX, manualNoteError } from "@/schemas/payment"

const manualFields = {
  amountPaid: z.number().int().nonnegative("Montant invalide"), // cents
  currency: z.enum(currency.enumValues),
  paymentMethod: z.string().trim().max(50).nullish(),
  notes: z.string().trim().max(MANUAL_NOTE_MAX).optional(),
}

type ManualFields = {
  amountPaid: number
  paymentMethod?: string | null
  notes?: string
}

// Un accès offert (montant nul) n'a pas de moyen de paiement ; son motif est
// obligatoire. Un paiement exige son moyen.
const checkManualPayment = (data: ManualFields, ctx: z.RefinementCtx) => {
  const free = data.amountPaid === 0
  if (!free && !data.paymentMethod) {
    ctx.addIssue({
      code: "custom",
      message: "Méthode de paiement requise",
      path: ["paymentMethod"],
    })
  }
  const noteError = manualNoteError(data.notes ?? "", free)
  if (noteError) {
    ctx.addIssue({ code: "custom", message: noteError, path: ["notes"] })
  }
}

const withoutMethodWhenFree = <T extends ManualFields>(data: T) => ({
  ...data,
  paymentMethod:
    data.amountPaid === 0 ? null : data.paymentMethod?.trim() || null,
})

export const recordManualPaymentSchema = z
  .object({
    userId: z.string().min(1, "Utilisateur requis"),
    productCode: z.enum(productCode.enumValues),
    ...manualFields,
  })
  .superRefine(checkManualPayment)
  .transform(withoutMethodWhenFree)

export type RecordManualPaymentInput = z.input<typeof recordManualPaymentSchema>

export const updateManualTransactionSchema = z
  .object({
    transactionId: z.string().min(1),
    ...manualFields,
    status: z.enum(["completed", "refunded"]).optional(),
  })
  .superRefine(checkManualPayment)
  .transform(withoutMethodWhenFree)

export type UpdateManualTransactionInput = z.input<
  typeof updateManualTransactionSchema
>
