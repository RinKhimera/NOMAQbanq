import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"

// Type du handle de transaction Drizzle (sans importer le type verbeux de pg-core).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const DAY_MS = 24 * 60 * 60 * 1000

const readAccess = (tx: Tx, userId: string, accessType: "exam" | "training") =>
  tx
    .select({ expiresAt: userAccess.expiresAt })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
    .then((r) => r[0])

export type CompleteStripeResult =
  | { status: "completed"; transactionId: string }
  | { status: "already_processed" }
  | { status: "not_found" }

/**
 * Fulfillment d'un paiement Stripe (webhook `checkout.session.completed`, payé).
 * Port de `completeStripeTransaction` Convex, durci :
 * - **Idempotence** vérifiée SOUS le verrou `user FOR UPDATE` (l'index unique
 *   `stripe_event_id` est le filet de sécurité). Deux livraisons concurrentes du
 *   même event ⇒ la 2e voit l'event déjà posé / la transaction déjà `completed`
 *   et sort sans re-créditer (la 1re sérialise via le verrou avant la 2e).
 * - **Cumul d'accès sûr** : verrou de ligne `user` (parité `grantManualAccess`).
 * - **Recalcul de l'expiration à la complétion** (plus correct que le précalcul au
 *   pending : `now` a avancé, l'accès existant a pu changer).
 *
 * `not_found` = aucune transaction pour cette session (anomalie : le pending est
 * créé avant la redirection Stripe, donc avant tout paiement) → l'appelant logue
 * et répond 200 (pas de retry utile).
 */
export async function completeStripeTransaction(params: {
  stripeSessionId: string
  stripePaymentIntentId: string
  stripeEventId: string
}): Promise<CompleteStripeResult> {
  return db.transaction(async (tx) => {
    // Transaction pending (pour obtenir l'userId à verrouiller).
    const [pending] = await tx
      .select({
        id: transactions.id,
        userId: transactions.userId,
        productId: transactions.productId,
        accessType: transactions.accessType,
        durationDays: transactions.durationDays,
      })
      .from(transactions)
      .where(eq(transactions.stripeSessionId, params.stripeSessionId))
      .limit(1)
    if (!pending) return { status: "not_found" }

    // Verrou utilisateur : sérialise octrois/révocations concurrents.
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, pending.userId))
      .for("update")

    // Idempotence SOUS verrou : event déjà traité, ou transaction déjà complétée.
    const [byEvent] = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.stripeEventId, params.stripeEventId))
      .limit(1)
    if (byEvent) return { status: "already_processed" }

    const [fresh] = await tx
      .select({ status: transactions.status })
      .from(transactions)
      .where(eq(transactions.id, pending.id))
      .limit(1)
    if (fresh?.status === "completed") return { status: "already_processed" }

    const [product] = await tx
      .select({ isCombo: products.isCombo })
      .from(products)
      .where(eq(products.id, pending.productId))
      .limit(1)
    const isCombo = product?.isCombo ?? false

    const now = new Date()
    const durationMs = pending.durationDays * DAY_MS

    // Expiration portée par la transaction : combo = now+durée ; non-combo = cumul.
    let txAccessExpiresAt: Date
    if (isCombo) {
      txAccessExpiresAt = new Date(now.getTime() + durationMs)
    } else {
      const existing = await readAccess(tx, pending.userId, pending.accessType)
      const base =
        existing && existing.expiresAt.getTime() > now.getTime()
          ? existing.expiresAt.getTime()
          : now.getTime()
      txAccessExpiresAt = new Date(base + durationMs)
    }

    await tx
      .update(transactions)
      .set({
        status: "completed",
        stripePaymentIntentId: params.stripePaymentIntentId || null,
        stripeEventId: params.stripeEventId,
        accessExpiresAt: txAccessExpiresAt,
        completedAt: now,
      })
      .where(eq(transactions.id, pending.id))

    const types: Array<"exam" | "training"> = isCombo
      ? ["exam", "training"]
      : [pending.accessType]
    for (const accessType of types) {
      const existing = await readAccess(tx, pending.userId, accessType)
      const finalExpiry = new Date(
        Math.max(
          existing?.expiresAt.getTime() ?? 0,
          txAccessExpiresAt.getTime(),
        ),
      )
      await tx
        .insert(userAccess)
        .values({
          userId: pending.userId,
          accessType,
          expiresAt: finalExpiry,
          lastTransactionId: pending.id,
        })
        .onConflictDoUpdate({
          target: [userAccess.userId, userAccess.accessType],
          set: { expiresAt: finalExpiry, lastTransactionId: pending.id },
        })
    }

    return { status: "completed", transactionId: pending.id }
  })
}

export type FailStripeResult = {
  status: "failed" | "already_processed" | "not_found"
}

/**
 * Marque une transaction Stripe comme échouée (webhook `checkout.session.expired`).
 * Idempotent via `stripeEventId`. Ne touche JAMAIS une transaction déjà `completed`
 * (un `expired` arrivant après un `completed` — improbable — ne révoque pas l'accès).
 */
export async function failStripeTransaction(params: {
  stripeSessionId: string
  stripeEventId: string
}): Promise<FailStripeResult> {
  return db.transaction(async (tx) => {
    const [byEvent] = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.stripeEventId, params.stripeEventId))
      .limit(1)
    if (byEvent) return { status: "already_processed" }

    const [pending] = await tx
      .select({ id: transactions.id, status: transactions.status })
      .from(transactions)
      .where(eq(transactions.stripeSessionId, params.stripeSessionId))
      .limit(1)
    if (!pending) return { status: "not_found" }
    if (pending.status === "completed") return { status: "already_processed" }

    await tx
      .update(transactions)
      .set({ status: "failed", stripeEventId: params.stripeEventId })
      .where(eq(transactions.id, pending.id))

    return { status: "failed" }
  })
}
