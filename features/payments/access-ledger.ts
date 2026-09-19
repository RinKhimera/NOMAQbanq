import { and, desc, eq, ne, or } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"

/**
 * Registre des accès : l'UNIQUE propriétaire de la règle qui relie les
 * transactions `completed` aux lignes `user_access`.
 *
 * - `applyGrant` : un octroi (Stripe ou manuel) — cumul/combo, snapshot porté
 *   par la transaction, upsert des types couverts, re-arm du rappel.
 * - `rebuildFromTransactions` : reconstruction depuis les transactions restantes
 *   (remboursement, litige perdu, modification ou suppression admin).
 *
 * Les deux verbes prennent le verrou `user FOR UPDATE` en premier : il sérialise
 * tous les octrois/retraits d'un même utilisateur (sans lui, deux paiements
 * concurrents lisent la même expiration et l'un écrase l'autre). Un appelant
 * qui détient déjà ce verrou dans la même transaction le re-prend sans coût.
 * C'est ce verrou, pris avant TOUTE écriture, qui exclut l'interblocage :
 * l'ordre des lignes filles (`transactions`, `user_access`) est ensuite libre.
 *
 * Invariant relié aux deux verbes : chaque transaction `completed` porte dans
 * `accessExpiresAt` le snapshot du cumul au moment de son octroi ; la
 * reconstruction relit ces snapshots (`max`) au lieu de re-simuler le cumul.
 */

// Type du handle de transaction Drizzle (sans importer le type verbeux de pg-core).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
/** Accepte le handle de transaction OU l'instance db (lectures hors transaction). */
type DbLike = Tx | typeof db

export type AccessType = "exam" | "training"

export type GrantedAccess = {
  accessType: AccessType
  /** Expiration EFFECTIVEMENT écrite (`max(existant, transaction)`). */
  expiresAt: Date
}

export type RebuildResult = {
  /** true si au moins un type d'accès a été supprimé ou raccourci. */
  accessReducedOrRemoved: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Verrou de ligne `user` : sérialise tous les écrivains d'accès d'un même
 * utilisateur. Les deux verbes le prennent eux-mêmes ; un appelant qui écrit
 * sur `transactions` AVANT de les appeler le prend d'abord, pour que le verrou
 * précède toujours la première écriture.
 */
export const lockUser = async (tx: Tx, userId: string): Promise<void> => {
  const [locked] = await tx
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .for("update")
  if (!locked) throw new Error("USER_NOT_FOUND")
}

const readAccess = (tx: Tx, userId: string, accessType: AccessType) =>
  tx
    .select({ expiresAt: userAccess.expiresAt })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
    .then((r): Date | null => r[0]?.expiresAt ?? null)

/**
 * Pose `expiresAt`/`lastTransactionId` sur un type d'accès. Le rappel de fin
 * d'accès n'est ré-armé (null) que si l'expiration AVANCE : un accès réduit ou
 * inchangé garde la trace du rappel déjà envoyé.
 */
const upsertAccess = async (
  tx: Tx,
  o: {
    userId: string
    accessType: AccessType
    expiresAt: Date
    transactionId: string
    existingExpiresAt: Date | null
  },
) => {
  const extended =
    o.existingExpiresAt === null ||
    o.expiresAt.getTime() > o.existingExpiresAt.getTime()
  await tx
    .insert(userAccess)
    .values({
      userId: o.userId,
      accessType: o.accessType,
      expiresAt: o.expiresAt,
      lastTransactionId: o.transactionId,
    })
    .onConflictDoUpdate({
      target: [userAccess.userId, userAccess.accessType],
      set: {
        expiresAt: o.expiresAt,
        lastTransactionId: o.transactionId,
        ...(extended ? { expiryReminderSentAt: null } : {}),
      },
    })
}

/**
 * Octroi d'accès porté par une transaction `completed` déjà en base (sa
 * `accessExpiresAt` provisoire est réécrite ici avec le snapshot du cumul).
 *
 * - **non-combo** : `(existant > now ? existant : now) + durée` — le temps se
 *   cumule sur un accès encore actif (15 j restants + 30 j = 45 j).
 * - **combo** : fenêtre fraîche `now + durée`, accordée sur exam ET training.
 * - `user_access.expiresAt = max(existant, transaction)` : un combo ne raccourcit
 *   jamais une expiration plus tardive déjà acquise. `lastTransactionId` pointe
 *   la transaction de l'octroi même dans ce cas.
 *
 * `now` est l'instant de l'octroi vu par l'appelant (fulfillment, saisie admin),
 * jamais repris d'un calcul antérieur.
 */
export async function applyGrant(
  tx: Tx,
  params: {
    userId: string
    product: { accessType: AccessType; isCombo: boolean }
    durationDays: number
    transactionId: string
    now: Date
  },
): Promise<GrantedAccess[]> {
  const { userId, product, durationDays, transactionId, now } = params
  await lockUser(tx, userId)

  const types: AccessType[] = product.isCombo
    ? ["exam", "training"]
    : [product.accessType]
  const existingByType = new Map<AccessType, Date | null>()
  for (const accessType of types) {
    existingByType.set(accessType, await readAccess(tx, userId, accessType))
  }

  const durationMs = durationDays * DAY_MS
  let base = now.getTime()
  if (!product.isCombo) {
    const existing = existingByType.get(product.accessType) ?? null
    if (existing && existing.getTime() > now.getTime())
      base = existing.getTime()
  }
  const transactionExpiresAt = new Date(base + durationMs)

  const stamped = await tx
    .update(transactions)
    .set({ accessExpiresAt: transactionExpiresAt })
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.status, "completed"),
      ),
    )
    .returning({ id: transactions.id })
  if (stamped.length === 0) throw new Error("TRANSACTION_NOT_COMPLETED")

  const granted: GrantedAccess[] = []
  for (const accessType of types) {
    const existing = existingByType.get(accessType) ?? null
    const expiresAt = new Date(
      Math.max(existing?.getTime() ?? 0, transactionExpiresAt.getTime()),
    )
    await upsertAccess(tx, {
      userId,
      accessType,
      expiresAt,
      transactionId,
      existingExpiresAt: existing,
    })
    granted.push({ accessType, expiresAt })
  }
  return granted
}

/**
 * Meilleure transaction `completed` couvrant ce type d'accès pour cet utilisateur :
 * `accessType` égal OU produit combo (un combo couvre exam ET training), expiration
 * la plus tardive. `excludeTransactionId` écarte une transaction en cours de
 * suppression. Tri secondaire (createdAt, id) pour un choix déterministe à égalité.
 */
export const bestCoveringTransaction = async (
  dbOrTx: DbLike,
  userId: string,
  accessType: AccessType,
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

/**
 * Reconstruit `user_access` (exam ET training) depuis les transactions `completed`
 * de l'utilisateur — les transactions sont la source de vérité. À appeler sur
 * TOUTE transition de statut (`completed ↔ refunded`) et AVANT la suppression
 * d'une transaction (avec `excludeTransactionId`, sinon la FK
 * `user_access.last_transaction_id` — NOT NULL, onDelete: restrict — bloque le
 * DELETE).
 *
 * L'expiration restaurée est `max(accessExpiresAt)` des transactions restantes,
 * c.-à-d. l'expiration telle qu'elle était AVANT la transaction retirée. On ne
 * re-simule PAS le cumul « comme si la transaction n'avait jamais existé » : un
 * snapshot périmé recrée une ligne déjà échue (aucun accès effectif).
 */
export async function rebuildFromTransactions(
  tx: Tx,
  params: { userId: string; excludeTransactionId?: string },
): Promise<RebuildResult> {
  const { userId, excludeTransactionId } = params
  await lockUser(tx, userId)

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

    if (existing && best.accessExpiresAt.getTime() < existing.getTime()) {
      accessReducedOrRemoved = true
    }
    await upsertAccess(tx, {
      userId,
      accessType,
      expiresAt: best.accessExpiresAt,
      transactionId: best.id,
      existingExpiresAt: existing,
    })
  }
  return { accessReducedOrRemoved }
}
