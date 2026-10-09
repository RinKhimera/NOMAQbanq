import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import "server-only"
import type Stripe from "stripe"
import { db } from "@/db"
import {
  paymentAlerts,
  products,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import { sendPaymentAlertEmail } from "@/email"
import type {
  AccessAfterRefund,
  AlertCandidate,
  PaymentAlert,
  StripeMoney,
} from "@/email/payment-alert"
import { eligibleRecipient, sendOnce } from "@/features/notifications/one-shot"
import { getBaseUrl } from "@/lib/base-url"
import { captureServerError } from "@/lib/observability"
import type { RefundStripeResult } from "./stripe"

const TAG = "[notif:alerte-paiement]"
/** Plafond de destinataires par événement : l'équipe compte quelques administrateurs. */
const RECIPIENT_LIMIT = 50

type AlertTransaction = {
  id: string
  userId: string
  name: string
  email: string
  productName: string
  isCombo: boolean
  accessType: "exam" | "training"
  amountPaid: number
  currency: "CAD" | "XAF"
  paidAt: Date
}

const findTransaction = async (
  paymentIntent: string | undefined,
): Promise<AlertTransaction | null> => {
  if (!paymentIntent) return null
  const [row] = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      name: user.name,
      email: user.email,
      productName: products.name,
      isCombo: products.isCombo,
      accessType: transactions.accessType,
      amountPaid: transactions.amountPaid,
      currency: transactions.currency,
      paidAt:
        sql<Date>`coalesce(${transactions.completedAt}, ${transactions.createdAt})`.mapWith(
          transactions.createdAt,
        ),
    })
    .from(transactions)
    .innerJoin(user, eq(user.id, transactions.userId))
    .innerJoin(products, eq(products.id, transactions.productId))
    .where(eq(transactions.stripePaymentIntentId, paymentIntent))
    .limit(1)
  return row ?? null
}

const candidateOf = (tx: AlertTransaction | null): AlertCandidate | null => {
  if (!tx) return null
  const params = new URLSearchParams({ client: tx.userId, tx: tx.id })
  return {
    name: tx.name,
    email: tx.email,
    productName: tx.productName,
    paidAt: tx.paidAt,
    transactionUrl: `${getBaseUrl()}/admin/transactions?${params}`,
  }
}

// L'app stocke le XAF en centièmes, Stripe en francs entiers (zéro-décimal).
const stripeMoneyOf = (tx: AlertTransaction): StripeMoney => ({
  amount: tx.currency === "XAF" ? tx.amountPaid / 100 : tx.amountPaid,
  currency: tx.currency.toLowerCase(),
})

/**
 * Accès du candidat après le recalcul d'un retour de fonds, lu APRÈS
 * `refundStripeTransaction`. Rien à annoncer si ce retour n'a rien retiré
 * (transaction jamais complétée, déjà remboursée, introuvable). Maintenu
 * seulement si chaque type que portait la transaction reste couvert par un
 * autre achat : un combo dont un seul type survit a bien perdu un accès.
 */
const accessAfterRefund = async (
  tx: AlertTransaction | null,
  refund: RefundStripeResult,
): Promise<AccessAfterRefund> => {
  if (!tx || refund.status !== "refunded") return null
  if (!refund.accessReducedOrRemoved) return "kept"
  const types: ("exam" | "training")[] = tx.isCombo
    ? ["exam", "training"]
    : [tx.accessType]
  const covered = await db
    .selectDistinct({ accessType: userAccess.accessType })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, tx.userId),
        inArray(userAccess.accessType, types),
        gt(userAccess.expiresAt, new Date()),
      ),
    )
    .limit(types.length)
  return covered.length === types.length ? "kept" : "removed"
}

const dashboardUrl = (event: Stripe.Event, paymentIntent: string | undefined) =>
  `https://dashboard.stripe.com/${event.livemode ? "" : "test/"}payments${paymentIntent ? `/${paymentIntent}` : ""}`

export const disputeOpenedAlert = async (
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  paymentIntent: string | undefined,
): Promise<PaymentAlert> => {
  const dueBy = dispute.evidence_details?.due_by
  return {
    kind: "dispute_opened",
    status: dispute.status,
    money: { amount: dispute.amount, currency: dispute.currency },
    dueBy: dueBy ? new Date(dueBy * 1000) : null,
    reason: dispute.reason,
    candidate: candidateOf(await findTransaction(paymentIntent)),
    stripeUrl: dashboardUrl(event, paymentIntent),
  }
}

/** `refund` : le retour de fonds d'un litige perdu, absent pour une autre issue. */
export const disputeClosedAlert = async (
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  paymentIntent: string | undefined,
  refund: RefundStripeResult | null,
): Promise<PaymentAlert> => {
  const tx = await findTransaction(paymentIntent)
  return {
    kind: "dispute_closed",
    status: dispute.status,
    money: { amount: dispute.amount, currency: dispute.currency },
    candidate: candidateOf(tx),
    access: refund ? await accessAfterRefund(tx, refund) : null,
    stripeUrl: dashboardUrl(event, paymentIntent),
  }
}

export const refundedAlert = async (
  event: Stripe.Event,
  charge: Stripe.Charge,
  paymentIntent: string,
  refund: RefundStripeResult,
): Promise<PaymentAlert> => {
  const tx = await findTransaction(paymentIntent)
  return {
    kind: "refunded",
    money: { amount: charge.amount, currency: charge.currency },
    candidate: candidateOf(tx),
    access: await accessAfterRefund(tx, refund),
    stripeUrl: dashboardUrl(event, paymentIntent),
  }
}

export const earlyFraudWarningAlert = async (
  event: Stripe.Event,
  paymentIntent: string | undefined,
): Promise<PaymentAlert> => {
  const tx = await findTransaction(paymentIntent)
  return {
    kind: "early_fraud_warning",
    money: tx ? stripeMoneyOf(tx) : null,
    candidate: candidateOf(tx),
    stripeUrl: dashboardUrl(event, paymentIntent),
  }
}

/**
 * Envoie l'alerte d'un événement Stripe à chaque administrateur éligible qui
 * ne l'a pas refusée. Une ligne `payment_alerts` par (événement,
 * administrateur) porte le marqueur de `sendOnce` : un événement rejoué
 * retrouve ses lignes déjà marquées et n'envoie rien.
 */
export async function sendPaymentAlert(
  eventId: string,
  alert: PaymentAlert,
): Promise<number> {
  const admins = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deletedAt)))
    .limit(RECIPIENT_LIMIT)
  if (admins.length === 0) return 0
  await db
    .insert(paymentAlerts)
    .values(admins.map((a) => ({ stripeEventId: eventId, userId: a.id })))
    .onConflictDoNothing()

  return sendOnce({
    tag: TAG,
    limit: RECIPIENT_LIMIT,
    select: ({ limit }) =>
      db
        .select({
          id: paymentAlerts.id,
          userId: user.id,
          email: user.email,
          name: user.name,
        })
        .from(paymentAlerts)
        .innerJoin(user, eq(user.id, paymentAlerts.userId))
        .where(
          and(
            eq(paymentAlerts.stripeEventId, eventId),
            isNull(paymentAlerts.sentAt),
            eq(user.role, "admin"),
            eq(user.notifyPaymentAlerts, true),
            eligibleRecipient,
          ),
        )
        .limit(limit),
    claim: {
      table: paymentAlerts,
      idColumn: paymentAlerts.id,
      markerColumn: paymentAlerts.sentAt,
    },
    send: (row) =>
      sendPaymentAlertEmail({ to: row.email, name: row.name, alert }),
    context: (row) => ({ userId: row.userId, detail: `événement ${eventId}` }),
  })
}

/**
 * Travail différé du fulfillment : construit l'alerte (lectures APRÈS les
 * écritures du fulfillment) puis l'envoie. Best-effort : l'événement est déjà
 * acquitté, Sentry garde la trace d'un échec.
 */
export const deferPaymentAlert =
  (event: Stripe.Event, build: () => Promise<PaymentAlert>) => async () => {
    try {
      await sendPaymentAlert(event.id, await build())
    } catch (error) {
      captureServerError(TAG, error, { detail: `événement ${event.id}` })
    }
  }
