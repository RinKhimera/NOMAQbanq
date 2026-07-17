import { and, desc, eq, ne, or } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
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
 * Octroi d'accès via un paiement manuel. À appeler
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
    // Renouvellement réel de CE type = l'expiration avance (ou 1er octroi).
    const renewed =
      !existing || finalExpiry.getTime() > existing.expiresAt.getTime()
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
        set: {
          expiresAt: finalExpiry,
          lastTransactionId: transactionId,
          // Re-arme le rappel de fin d'accès uniquement si l'accès est prolongé.
          ...(renewed ? { expiryReminderSentAt: null } : {}),
        },
      })
  }

  return transactionId
}

/** Accepte le handle de transaction OU l'instance db (lectures hors transaction). */
type DbLike = Tx | typeof db

/**
 * Meilleure transaction `completed` couvrant ce type d'accès pour cet utilisateur :
 * `accessType` égal OU produit combo (un combo couvre exam ET training), expiration
 * la plus tardive. `excludeTransactionId` écarte une transaction en cours de
 * suppression. Tri secondaire (createdAt, id) pour un choix déterministe à égalité.
 */
export const bestCoveringTransaction = async (
  dbOrTx: DbLike,
  userId: string,
  accessType: "exam" | "training",
  excludeTransactionId?: string,
): Promise<{ id: string; accessExpiresAt: Date } | null> => {
  const rows = await dbOrTx
    .select({
      id: transactions.id,
      accessExpiresAt: transactions.accessExpiresAt,
    })
    .from(transactions)
    .innerJoin(products, eq(products.id, transactions.productId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "completed"),
        or(eq(transactions.accessType, accessType), eq(products.isCombo, true)),
        excludeTransactionId
          ? ne(transactions.id, excludeTransactionId)
          : undefined,
      ),
    )
    .orderBy(
      desc(transactions.accessExpiresAt),
      desc(transactions.createdAt),
      desc(transactions.id),
    )
    .limit(1)
  return rows[0] ?? null
}

export type RecomputeAccessResult = {
  /** true si au moins un type d'accès a été supprimé ou raccourci. */
  accessReducedOrRemoved: boolean
}

/**
 * Reconstruit `user_access` (exam ET training) depuis les transactions `completed`
 * de l'utilisateur — les transactions sont la source de vérité. À appeler DANS
 * `db.transaction`, sur TOUTE transition de statut (`completed ↔ refunded`) et
 * AVANT la suppression d'une transaction (avec `excludeTransactionId`, sinon la FK
 * `user_access.last_transaction_id` — NOT NULL, onDelete: restrict — bloque le DELETE).
 * Verrou `user FOR UPDATE` : parité avec `grantManualAccess`/`completeStripeTransaction`.
 *
 * Sémantique : l'expiration restaurée est `max(accessExpiresAt)` des transactions
 * restantes — c.-à-d. l'expiration telle qu'elle était AVANT la transaction retirée
 * (chaque transaction porte le snapshot du cumul à son octroi). On ne re-simule PAS
 * le cumul « comme si la transaction n'avait jamais existé ».
 *
 * `expiryReminderSentAt` : ré-armé (null) uniquement si l'expiration avance —
 * même règle que `grantManualAccess`.
 */
export async function recomputeAccess(
  tx: Tx,
  params: { userId: string; excludeTransactionId?: string },
): Promise<RecomputeAccessResult> {
  const { userId, excludeTransactionId } = params

  const [lockedUser] = await tx
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .for("update")
  if (!lockedUser) throw new Error("USER_NOT_FOUND")

  let accessReducedOrRemoved = false

  for (const accessType of ["exam", "training"] as const) {
    const existing = await readAccess(tx, userId, accessType)
    const best = await bestCoveringTransaction(
      tx,
      userId,
      accessType,
      excludeTransactionId,
    )

    if (!best) {
      if (existing) {
        accessReducedOrRemoved = true
        await tx
          .delete(userAccess)
          .where(
            and(
              eq(userAccess.userId, userId),
              eq(userAccess.accessType, accessType),
            ),
          )
      }
      continue
    }

    const extended =
      !existing || best.accessExpiresAt.getTime() > existing.expiresAt.getTime()
    if (
      existing &&
      best.accessExpiresAt.getTime() < existing.expiresAt.getTime()
    )
      accessReducedOrRemoved = true

    await tx
      .insert(userAccess)
      .values({
        userId,
        accessType,
        expiresAt: best.accessExpiresAt,
        lastTransactionId: best.id,
      })
      .onConflictDoUpdate({
        target: [userAccess.userId, userAccess.accessType],
        set: {
          expiresAt: best.accessExpiresAt,
          lastTransactionId: best.id,
          // Re-arme le rappel de fin d'accès uniquement si l'accès est prolongé.
          ...(extended ? { expiryReminderSentAt: null } : {}),
        },
      })
  }

  return { accessReducedOrRemoved }
}
