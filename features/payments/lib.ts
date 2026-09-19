import "server-only"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { createId } from "@/lib/ids"
import { applyGrant, lockUser } from "./access-ledger"

// Type du handle de transaction Drizzle (sans importer le type verbeux de pg-core).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
 * `db.transaction`. Retourne l'id de la transaction insérée.
 */
export async function grantManualAccess(
  tx: Tx,
  params: {
    userId: string
    product: ProductForGrant
    amountPaid: number
    currency: "CAD" | "XAF"
    paymentMethod: string
    notes?: string | null
    recordedBy: string
    /** Instant de l'octroi (défaut : maintenant) ; injectable par les tests. */
    now?: Date
  },
): Promise<string> {
  const { userId, product } = params
  const now = params.now ?? new Date()

  await lockUser(tx, userId)

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

  await applyGrant(tx, {
    userId,
    product,
    durationDays: product.durationDays,
    transactionId,
    now,
  })

  return transactionId
}
