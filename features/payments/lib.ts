import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import { createId } from "@/lib/ids"

// Type du handle de transaction Drizzle (sans importer le type verbeux de pg-core).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const DAY_MS = 24 * 60 * 60 * 1000

export type ProductForGrant = {
  id: string
  accessType: "exam" | "training"
  durationDays: number
  isCombo: boolean
}

const readAccess = (tx: Tx, userId: string, accessType: "exam" | "training") =>
  tx
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
    })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
    .then((r) => r[0])

/**
 * Octroi d'accès via un paiement manuel (port exact de la logique Convex). À appeler
 * DANS `db.transaction`. Verrou de ligne `user` FOR UPDATE → sérialise tous les
 * octrois/révocations du même utilisateur (sinon deux paiements concurrents lisent la
 * même expiration et l'un écrase l'autre = lost-update sur le cumul).
 *
 * - **non-combo** : `accessExpiresAt = (existant>now ? existant : now) + durée` (cumul).
 * - **combo** : `accessExpiresAt = now + durée`, accordé sur exam ET training.
 * - `userAccess.expiresAt = max(existant, accessExpiresAt)` (combo peut conserver une
 *   expiration plus tardive déjà acquise) ; `lastTransactionId` = la transaction créée.
 *
 * Retourne l'id de la transaction insérée.
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
  },
): Promise<string> {
  const { userId, product } = params

  const [lockedUser] = await tx
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .for("update")
  if (!lockedUser) throw new Error("USER_NOT_FOUND")

  const now = new Date()
  const durationMs = product.durationDays * DAY_MS
  const types: Array<"exam" | "training"> = product.isCombo
    ? ["exam", "training"]
    : [product.accessType]

  // Expiration portée par la transaction (combo = now+durée ; non-combo = cumul).
  let txAccessExpiresAt: Date
  if (product.isCombo) {
    txAccessExpiresAt = new Date(now.getTime() + durationMs)
  } else {
    const existing = await readAccess(tx, userId, product.accessType)
    const base =
      existing && existing.expiresAt.getTime() > now.getTime()
        ? existing.expiresAt.getTime()
        : now.getTime()
    txAccessExpiresAt = new Date(base + durationMs)
  }

  const transactionId = createId()
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
    accessExpiresAt: txAccessExpiresAt,
    createdAt: now,
    completedAt: now,
  })

  for (const accessType of types) {
    const existing = await readAccess(tx, userId, accessType)
    const finalExpiry = new Date(
      Math.max(existing?.expiresAt.getTime() ?? 0, txAccessExpiresAt.getTime()),
    )
    await tx
      .insert(userAccess)
      .values({
        userId,
        accessType,
        expiresAt: finalExpiry,
        lastTransactionId: transactionId,
      })
      .onConflictDoUpdate({
        target: [userAccess.userId, userAccess.accessType],
        set: { expiresAt: finalExpiry, lastTransactionId: transactionId },
      })
  }

  return transactionId
}

/**
 * Révoque l'accès SEULEMENT si la transaction donnée est la dernière à l'avoir accordé
 * (`userAccess.lastTransactionId === transaction.id`). À appeler DANS `db.transaction`.
 * Verrou utilisateur cohérent avec `grantManualAccess`. Retourne `true` si révoqué.
 */
export async function revokeAccessIfLast(
  tx: Tx,
  transaction: { id: string; userId: string; accessType: "exam" | "training" },
): Promise<boolean> {
  await tx
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, transaction.userId))
    .for("update")

  const existing = await readAccess(tx, transaction.userId, transaction.accessType)
  if (existing && existing.lastTransactionId === transaction.id) {
    await tx
      .delete(userAccess)
      .where(
        and(
          eq(userAccess.userId, transaction.userId),
          eq(userAccess.accessType, transaction.accessType),
        ),
      )
    return true
  }
  return false
}
