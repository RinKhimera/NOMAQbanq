import { eq } from "drizzle-orm"
import "server-only"
import { transactions, user } from "@/db/schema"
import { createId } from "@/lib/ids"
import {
  type AppliedGrant,
  type Tx,
  applyGrant,
  lockUser,
} from "./access-ledger"

export type ProductForGrant = {
  id: string
  accessType: "exam" | "training"
  durationDays: number
  isCombo: boolean
}

/**
 * Paiement manuel : sous verrou `user FOR UPDATE`, insère la transaction
 * `completed` puis confie l'octroi à `applyGrant` (`access-ledger.ts`), qui
 * réécrit `accessExpiresAt` avec le snapshot du cumul. À appeler DANS
 * `db.transaction`. Retourne l'id de la transaction insérée et l'octroi du
 * registre (expiration écrite et échéance remplacée, par type d'accès).
 */
export async function grantManualAccess(
  tx: Tx,
  params: {
    userId: string
    product: ProductForGrant
    amountPaid: number
    currency: "CAD" | "XAF"
    /** Nul pour un accès offert (montant nul). */
    paymentMethod: string | null
    notes?: string | null
    recordedBy: string
    /** Instant de l'octroi (défaut : maintenant) ; injectable par les tests. */
    now?: Date
  },
): Promise<{
  transactionId: string
  granted: AppliedGrant[]
  recordedAt: Date
}> {
  const { userId, product } = params
  await lockUser(tx, userId)
  // Un compte supprimé ou anonymisé ne reçoit plus d'octroi (lu sous le verrou).
  const [target] = await tx
    .select({ deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, userId))
  if (target?.deletedAt) throw new Error("USER_NOT_FOUND")
  // Lu APRÈS le verrou : l'attente d'un octroi concurrent ne doit pas avancer
  // l'octroi dans le passé.
  const now = params.now ?? new Date()

  const transactionId = createId()
  // `accessExpiresAt` provisoire : `applyGrant` pose la valeur définitive (la
  // colonne est NOT NULL et la FK de `user_access` exige la ligne avant l'upsert).
  await tx.insert(transactions).values({
    id: transactionId,
    userId,
    productId: product.id,
    type: "manual",
    status: "completed",
    amountPaid: params.amountPaid,
    currency: params.currency,
    paymentMethod: params.paymentMethod,
    recordedBy: params.recordedBy,
    notes: params.notes ?? null,
    accessType: product.accessType,
    durationDays: product.durationDays,
    accessExpiresAt: now,
    createdAt: now,
    completedAt: now,
  })

  const granted = await applyGrant(tx, {
    userId,
    product,
    durationDays: product.durationDays,
    transactionId,
    now,
  })

  return { transactionId, granted, recordedAt: now }
}
