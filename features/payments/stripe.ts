import { and, eq, inArray, isNull, ne, notInArray, or } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { products, transactions, user } from "@/db/schema"
import {
  type GrantedAccess,
  applyGrant,
  rebuildFromTransactions,
} from "./access-ledger"

export type PurchaseConfirmationData = {
  /** Null si le compte est anonymisé : aucun courriel à envoyer. */
  userEmail: string | null
  /** Nom complet, null si anonymisé (comme userEmail) : sert à la salutation. */
  userName: string | null
  productName: string
  amountPaid: number
  currency: "CAD" | "XAF"
  presentmentAmount: number | null
  presentmentCurrency: string | null
  completedAt: Date
  /** Expirations EFFECTIVEMENT écrites (max(existant, transaction)), une par type. */
  grantedAccess: GrantedAccess[]
}

export type CompleteStripeResult =
  | {
      status: "completed"
      transactionId: string
      confirmation: PurchaseConfirmationData
    }
  | { status: "already_processed" }
  | { status: "not_found" }

const CURRENCY_BY_STRIPE = new Map<string, "CAD" | "XAF">([
  ["cad", "CAD"],
  ["xaf", "XAF"],
])

/**
 * Fulfillment d'un paiement Stripe (webhook `checkout.session.completed`, payé).
 * Garanties :
 * - **Idempotence** vérifiée SOUS le verrou `user FOR UPDATE` (l'index unique
 *   `stripe_event_id` est le filet de sécurité). Deux livraisons concurrentes du
 *   même event ⇒ la 2e voit l'event déjà posé / la transaction déjà `completed`
 *   et sort sans re-créditer (la 1re sérialise via le verrou avant la 2e).
 * - **Octroi par `applyGrant`** (`access-ledger.ts`) sous le même verrou de
 *   ligne `user` : l'expiration est recalculée à la complétion (le précalcul du
 *   pending est écrasé — `now` a avancé, l'accès existant a pu changer).
 *
 * `not_found` = aucune transaction pour cette session (anomalie : le pending est
 * créé avant la redirection Stripe, donc avant tout paiement) → l'appelant logue
 * et répond 200 (pas de retry utile).
 *
 * `amountTotal`/`currency` (session Checkout) écrasent les valeurs provisoires du
 * pending (prix catalogue CAD) : seuls les CODES PROMO font effectivement diverger
 * le montant facturé du prix catalogue. Adaptive Pricing, lui, ne change ni la
 * devise ni le montant de la session — le montant local vit dans
 * `presentment_details`, persisté à part. La conversion XAF ×100 ci-dessous reste
 * correcte (le XAF est zéro-décimal chez Stripe) mais n'est atteinte que si un
 * prix est RÉELLEMENT libellé en XAF. Valeurs inexploitables (`amount_total`
 * null, devise hors enum) → on conserve le provisoire et on logue — un paiement
 * valide ne doit jamais échouer pour un problème de réconciliation.
 */
export async function completeStripeTransaction(params: {
  stripeSessionId: string
  stripePaymentIntentId: string
  stripeEventId: string
  amountTotal?: number | null
  currency?: string | null
  presentmentAmount?: number | null
  presentmentCurrency?: string | null
  /** Instant du fulfillment (défaut : maintenant) ; injectable par les tests. */
  now?: Date
}): Promise<CompleteStripeResult> {
  const now = params.now ?? new Date()
  return db.transaction(async (tx) => {
    // Transaction pending (pour obtenir l'userId à verrouiller).
    const [pending] = await tx
      .select({
        id: transactions.id,
        userId: transactions.userId,
        productId: transactions.productId,
        accessType: transactions.accessType,
        durationDays: transactions.durationDays,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
      })
      .from(transactions)
      .where(eq(transactions.stripeSessionId, params.stripeSessionId))
      .limit(1)
    if (!pending) return { status: "not_found" }

    // Verrou utilisateur : sérialise octrois/révocations concurrents. Le
    // courriel et l'état d'anonymisation sont lus sous le même verrou pour
    // le courriel de confirmation.
    const [lockedUser] = await tx
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        anonymizedAt: user.anonymizedAt,
      })
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
      .select({ isCombo: products.isCombo, name: products.name })
      .from(products)
      .where(eq(products.id, pending.productId))
      .limit(1)
    const isCombo = product?.isCombo ?? false

    const realCurrency = params.currency
      ? CURRENCY_BY_STRIPE.get(params.currency.toLowerCase())
      : undefined
    const reconcile =
      params.amountTotal != null && realCurrency !== undefined
        ? {
            // Stripe traite le XAF en zéro-décimal (francs entiers) alors que
            // l'app stocke tout en centièmes (parseAmountToCents/formatCurrency).
            amountPaid:
              realCurrency === "XAF"
                ? params.amountTotal * 100
                : params.amountTotal,
            currency: realCurrency,
          }
        : null
    if (
      !reconcile &&
      (params.amountTotal !== undefined || params.currency !== undefined)
    ) {
      console.error(
        "[stripe fulfillment] montant/devise inexploitables, valeurs provisoires conservées",
        {
          stripeSessionId: params.stripeSessionId,
          amountTotal: params.amountTotal,
          currency: params.currency,
        },
      )
    }

    // Adaptive Pricing : présent UNIQUEMENT si le client a payé dans sa devise
    // locale. Absent pour un client canadien — les colonnes restent nulles, et
    // c'est ce qui rend la proportion de conversions mesurable. Ne jamais faire
    // échouer un paiement valide sur de la traçabilité : valeurs partielles
    // ⇒ on n'écrit rien.
    const presentment =
      params.presentmentAmount != null && params.presentmentCurrency
        ? {
            presentmentAmount: params.presentmentAmount,
            presentmentCurrency: params.presentmentCurrency.toUpperCase(),
          }
        : null

    await tx
      .update(transactions)
      .set({
        status: "completed",
        stripePaymentIntentId: params.stripePaymentIntentId || null,
        stripeEventId: params.stripeEventId,
        completedAt: now,
        ...(reconcile ?? {}),
        ...(presentment ?? {}),
      })
      .where(eq(transactions.id, pending.id))

    // La durée vient du snapshot de la transaction (prix/durée au moment de
    // l'achat), pas du produit courant.
    const grantedAccess = await applyGrant(tx, {
      userId: pending.userId,
      product: { accessType: pending.accessType, isCombo },
      durationDays: pending.durationDays,
      transactionId: pending.id,
      now,
    })

    return {
      status: "completed",
      transactionId: pending.id,
      confirmation: {
        userEmail:
          lockedUser && !lockedUser.anonymizedAt ? lockedUser.email : null,
        userName:
          lockedUser && !lockedUser.anonymizedAt ? lockedUser.name : null,
        productName: product?.name ?? "Accès NOMAQbanq",
        amountPaid: reconcile?.amountPaid ?? pending.amountPaid,
        currency: reconcile?.currency ?? pending.currency,
        presentmentAmount: presentment?.presentmentAmount ?? null,
        presentmentCurrency: presentment?.presentmentCurrency ?? null,
        completedAt: now,
        grantedAccess,
      },
    }
  })
}

export type FailStripeResult =
  | { status: "failed"; transactionId: string }
  | { status: "already_processed" | "not_found" }

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

    // UPDATE gardé `status='pending'` : si la ligne a été complétée entre la
    // lecture et l'écriture (course théorique — Stripe n'émet jamais `expired`
    // après `completed`), l'UPDATE est un no-op et on ne révoque rien.
    const updated = await tx
      .update(transactions)
      .set({ status: "failed", stripeEventId: params.stripeEventId })
      .where(
        and(
          eq(transactions.id, pending.id),
          eq(transactions.status, "pending"),
        ),
      )
      .returning({ id: transactions.id })

    return updated.length > 0
      ? { status: "failed", transactionId: pending.id }
      : { status: "already_processed" }
  })
}

// Statuts après lesquels Stripe ne renvoie plus de changement d'état pour CE
// litige (`prevented` existe dans le SDK et est terminal).
const TERMINAL_DISPUTE_STATUSES = [
  "won",
  "lost",
  "warning_closed",
  "prevented",
] as const

export type RecordDisputeResult = {
  status: "recorded" | "kept" | "not_found"
}

/**
 * Rattache un litige Stripe à la transaction de son `payment_intent` et
 * enregistre son statut courant. Idempotent (même valeur réécrite).
 *
 * Stripe ne garantit pas l'ordre de livraison : un statut terminal n'est
 * jamais écrasé par un statut non terminal DU MÊME litige arrivé en retard.
 * Un litige différent (Stripe documente « plusieurs litiges par paiement »)
 * remplace toujours le précédent, même clos : sinon un « litige gagné »
 * masquerait un chargeback vivant. L'UPDATE unique suffit à sérialiser deux
 * livraisons concurrentes (le prédicat est réévalué sur la ligne réécrite).
 */
export async function recordStripeDispute(params: {
  stripePaymentIntentId: string
  /**
   * Repli quand la transaction est encore `pending` (litige arrivé avant le
   * fulfillment) : elle n'a pas de payment_intent, mais sa session Checkout
   * est connue dès le pending. Le payment_intent est alors posé au passage.
   */
  stripeSessionId?: string
  stripeDisputeId: string
  disputeStatus: string
}): Promise<RecordDisputeResult> {
  const incomingIsTerminal = (
    TERMINAL_DISPUTE_STATUSES as readonly string[]
  ).includes(params.disputeStatus)
  const matchesTransaction = params.stripeSessionId
    ? or(
        eq(transactions.stripePaymentIntentId, params.stripePaymentIntentId),
        eq(transactions.stripeSessionId, params.stripeSessionId),
      )
    : eq(transactions.stripePaymentIntentId, params.stripePaymentIntentId)

  const updated = await db
    .update(transactions)
    .set({
      stripeDisputeId: params.stripeDisputeId,
      disputeStatus: params.disputeStatus,
      ...(params.stripeSessionId
        ? { stripePaymentIntentId: params.stripePaymentIntentId }
        : {}),
    })
    .where(
      and(
        matchesTransaction,
        // Garde-fou symétrique. Statut entrant NON terminal : écrit sauf si le
        // MÊME litige est déjà clos (redélivrance tardive). Statut entrant
        // terminal : écrit sauf si un AUTRE litige est encore vivant (un
        // `closed` rejoué en retard ne doit pas masquer un chargeback en cours).
        incomingIsTerminal
          ? or(
              isNull(transactions.stripeDisputeId),
              eq(transactions.stripeDisputeId, params.stripeDisputeId),
              isNull(transactions.disputeStatus),
              inArray(transactions.disputeStatus, [
                ...TERMINAL_DISPUTE_STATUSES,
              ]),
            )
          : or(
              isNull(transactions.stripeDisputeId),
              ne(transactions.stripeDisputeId, params.stripeDisputeId),
              isNull(transactions.disputeStatus),
              notInArray(transactions.disputeStatus, [
                ...TERMINAL_DISPUTE_STATUSES,
              ]),
            ),
      ),
    )
    .returning({ id: transactions.id })
  if (updated.length > 0) return { status: "recorded" }

  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(matchesTransaction)
    .limit(1)
  return { status: existing ? "kept" : "not_found" }
}

export type RefundStripeResult =
  | { status: "refunded"; userId: string; accessReducedOrRemoved: boolean }
  | {
      status: "skipped"
      currentStatus: (typeof transactions.status.enumValues)[number]
    }
  | { status: "not_found" }

/**
 * Retour de fonds Stripe (remboursement complet ou litige perdu) : la
 * transaction passe de `completed` à `refunded` et l'accès qu'elle portait
 * est recalculé depuis les transactions restantes (`rebuildFromTransactions`).
 * Idempotent par construction : seul un statut `completed` est réécrit — un
 * rejeu de l'événement retombe en `skipped`. Verrou `user FOR UPDATE` AVANT
 * l'écriture sur `transactions`, même ordre que `updateManualTransaction`.
 * Un remboursement partiel ne passe jamais ici (décidé par le webhook).
 */
export async function refundStripeTransaction(params: {
  stripePaymentIntentId: string
  refundedAt: Date
}): Promise<RefundStripeResult> {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({
        id: transactions.id,
        userId: transactions.userId,
        status: transactions.status,
      })
      .from(transactions)
      .where(
        eq(transactions.stripePaymentIntentId, params.stripePaymentIntentId),
      )
      .limit(1)
    if (!found) return { status: "not_found" as const }

    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, found.userId))
      .for("update")

    const updated = await tx
      .update(transactions)
      .set({ status: "refunded", refundedAt: params.refundedAt })
      .where(
        and(
          eq(transactions.id, found.id),
          eq(transactions.status, "completed"),
        ),
      )
      .returning({ id: transactions.id })
    if (updated.length === 0) {
      // Relu SOUS verrou : le statut peut avoir changé depuis le premier SELECT.
      const [fresh] = await tx
        .select({ status: transactions.status })
        .from(transactions)
        .where(eq(transactions.id, found.id))
        .limit(1)
      return {
        status: "skipped" as const,
        currentStatus: fresh?.status ?? found.status,
      }
    }

    const { accessReducedOrRemoved } = await rebuildFromTransactions(tx, {
      userId: found.userId,
    })
    return {
      status: "refunded" as const,
      userId: found.userId,
      accessReducedOrRemoved,
    }
  })
}

/** Trace d'envoi du courriel de confirmation (corrélation avec le journal SES). */
export async function markConfirmationEmailSent(params: {
  transactionId: string
  messageId: string
}): Promise<void> {
  await db
    .update(transactions)
    .set({
      confirmationEmailMessageId: params.messageId,
      confirmationEmailSentAt: new Date(),
    })
    .where(eq(transactions.id, params.transactionId))
}
