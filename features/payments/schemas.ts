import { z } from "zod"

import { currency, productCode } from "@/db/schema"

export const recordManualPaymentSchema = z.object({
  userId: z.string().min(1, "Utilisateur requis"),
  productCode: z.enum(productCode.enumValues),
  amountPaid: z.number().int().nonnegative("Montant invalide"), // cents
  currency: z.enum(currency.enumValues),
  paymentMethod: z.string().trim().min(1, "Méthode de paiement requise"),
  notes: z.string().trim().max(1000).optional(),
})

export type RecordManualPaymentInput = z.infer<typeof recordManualPaymentSchema>

export const updateManualTransactionSchema = z.object({
  transactionId: z.string().min(1),
  amountPaid: z.number().int().nonnegative("Montant invalide"),
  currency: z.enum(currency.enumValues),
  paymentMethod: z.string().trim().min(1, "Méthode de paiement requise"),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["completed", "refunded"]).optional(),
})

export type UpdateManualTransactionInput = z.infer<
  typeof updateManualTransactionSchema
>
