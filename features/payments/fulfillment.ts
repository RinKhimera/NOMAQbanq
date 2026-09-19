import "server-only"
import type Stripe from "stripe"
import { sendPurchaseConfirmationEmail } from "@/email"
import { sendAbandonedCartReminder } from "@/features/notifications/abandoned-cart"
import { captureServerError } from "@/lib/observability"
import { findCheckoutSessionByPaymentIntent } from "@/lib/stripe"
import {
  type CompleteStripeResult,
  type RefundStripeResult,
  completeStripeTransaction,
  failStripeTransaction,
  markConfirmationEmailSent,
  recordStripeDispute,
  refundStripeTransaction,
} from "./stripe"

// Une session promo 100 % est complétée avec `no_payment_required` (montant nul,
// pas de PaymentIntent) : elle doit accorder l'accès au même titre qu'un `paid`.
const FULFILLABLE_PAYMENT_STATUSES: ReadonlyArray<Stripe.Checkout.Session.PaymentStatus> =
  ["paid", "no_payment_required"]

export type Fulfillment = {
  /**
   * Travail à exécuter APRÈS l'acquittement (courriel de confirmation, rappel
   * de panier) : Stripe exige une réponse rapide, et un retry retomberait en
   * `already_processed` sans courriel ni trace. Au plus un par événement.
   */
  deferred?: () => Promise<void>
}

// Stripe livre `payment_intent` tantôt en id, tantôt en objet (expand).
const paymentIntentIdOf = (
  ref: string | { id: string } | null | undefined,
): string | undefined => (typeof ref === "string" ? ref : ref?.id)

/**
 * Courriel de confirmation, en best-effort. L'accès est déjà COMMITÉ quand on
 * arrive ici : un échec ne change rien au fulfillment. Le reçu Stripe
 * (`receipt_email`) part de son côté. Sentry est la seule trace d'un échec.
 */
const sendConfirmation = async (
  result: Extract<CompleteStripeResult, { status: "completed" }>,
) => {
  const c = result.confirmation
  // Compte anonymisé : cas nominal (suppression de compte en cours), pas une
  // erreur — un simple log, sans Sentry.
  if (!c.userEmail) {
    console.warn(
      `[stripe webhook] courriel de confirmation non envoyé, compte anonymisé · transaction ${result.transactionId}`,
    )
    return
  }
  try {
    const messageId = await sendPurchaseConfirmationEmail({
      to: c.userEmail,
      name: c.userName,
      productName: c.productName,
      amountPaid: c.amountPaid,
      currency: c.currency,
      presentmentAmount: c.presentmentAmount,
      presentmentCurrency: c.presentmentCurrency,
      purchasedAt: c.completedAt,
      grantedAccess: c.grantedAccess,
    })
    await markConfirmationEmailSent({
      transactionId: result.transactionId,
      messageId,
    })
  } catch (error) {
    captureServerError("[stripe:webhook]", error, {
      detail: `courriel de confirmation non envoyé · transaction ${result.transactionId}`,
    })
  }
}

const describeRefund = (result: RefundStripeResult): string => {
  if (result.status === "refunded") {
    return result.accessReducedOrRemoved
      ? "accès retiré"
      : "accès conservé, une autre transaction couvre"
  }
  if (result.status === "skipped") {
    return result.currentStatus === "refunded"
      ? "déjà refunded"
      : `transaction non complétée (${result.currentStatus})`
  }
  return "transaction introuvable"
}

// Un retour de fonds sur une transaction pending/failed est une anomalie à
// alerter : un paiement différé encore pending peut être complété APRÈS le
// remboursement et octroyer un accès que personne ne verrait.
const reportRefundOutcome = (refund: RefundStripeResult, detail: string) => {
  if (refund.status === "not_found") {
    captureServerError(
      "[stripe:webhook]",
      new Error("remboursement sans transaction correspondante"),
      { detail },
    )
  } else if (
    refund.status === "skipped" &&
    refund.currentStatus !== "refunded"
  ) {
    captureServerError(
      "[stripe:webhook]",
      new Error("retour de fonds sur une transaction non complétée"),
      { detail: `${detail} · statut ${refund.currentStatus}` },
    )
  } else {
    console.warn(
      `[stripe webhook] retour de fonds · ${detail} · ${describeRefund(refund)}`,
    )
  }
}

// Un moyen de paiement différé (virement, prélèvement) complète la session en
// `unpaid` puis confirme des heures/jours plus tard par un second événement :
// sans cette branche, ces clients paient sans jamais recevoir l'accès. Même
// chemin d'octroi (idempotent), donc un `completed` suivi d'un
// `async_payment_succeeded` ne crédite qu'une fois.
const fulfilCheckout = async (
  event: Stripe.Event,
  checkoutSession: Stripe.Checkout.Session,
): Promise<Fulfillment> => {
  if (!FULFILLABLE_PAYMENT_STATUSES.includes(checkoutSession.payment_status)) {
    return {}
  }
  const result = await completeStripeTransaction({
    stripeSessionId: checkoutSession.id,
    stripePaymentIntentId:
      paymentIntentIdOf(checkoutSession.payment_intent) ?? "",
    stripeEventId: event.id,
    // Montant réellement facturé : un code promo fait diverger `amount_total`
    // du prix catalogue. (Adaptive Pricing, lui, ne change PAS la devise de la
    // session — voir `presentment_details` juste en dessous.)
    amountTotal: checkoutSession.amount_total,
    currency: checkoutSession.currency,
    // Ce que le client a réellement vu et payé dans sa devise locale.
    presentmentAmount: checkoutSession.presentment_details?.presentment_amount,
    presentmentCurrency:
      checkoutSession.presentment_details?.presentment_currency,
  })
  if (result.status === "not_found") {
    // Transaction fantôme (payé sans pending en base) : anomalie réelle, mais
    // acquittée — rejouer l'événement ne la fera pas apparaître.
    captureServerError(
      "[stripe:webhook]",
      new Error("aucune transaction pour la session Stripe"),
      { detail: `session ${checkoutSession.id}` },
    )
  }
  return result.status === "completed"
    ? { deferred: () => sendConfirmation(result) }
    : {}
}

// Un litige prélève la somme + des frais et ouvre une fenêtre de réponse
// limitée : sans alerte, elle se referme sans que personne ne l'ait vue.
// Traitement humain (aucune révocation automatique d'accès : couper l'accès
// affaiblirait la position « service livré et utilisé »). L'alerte part AVANT
// l'écriture en base : une panne Neon ne doit pas la priver de son détail.
const fulfilDispute = async (
  event: Stripe.Event,
  dispute: Stripe.Dispute,
): Promise<Fulfillment> => {
  // Le `payment_intent` est la SEULE clé qui relie le litige à un client : il
  // rejoint `transactions.stripe_payment_intent_id`.
  const disputedPaymentIntent = paymentIntentIdOf(dispute.payment_intent)
  const detail = `dispute ${dispute.id} · ${dispute.amount} ${dispute.currency} · motif ${dispute.reason} · statut ${dispute.status} · payment_intent ${disputedPaymentIntent ?? "absent"}`

  if (event.type === "charge.dispute.created") {
    captureServerError(
      "[stripe:webhook]",
      new Error("litige ouvert sur un paiement Stripe"),
      { detail },
    )
  } else if (event.type === "charge.dispute.closed") {
    const outcome =
      dispute.status === "won"
        ? "litige gagné"
        : dispute.status === "lost"
          ? "litige perdu"
          : "litige clos"
    captureServerError("[stripe:webhook]", new Error(outcome), { detail })
  } else if (event.type === "charge.dispute.funds_reinstated") {
    captureServerError(
      "[stripe:webhook]",
      new Error("fonds restitués après litige"),
      { detail },
    )
  }

  if (disputedPaymentIntent) {
    let recorded = await recordStripeDispute({
      stripePaymentIntentId: disputedPaymentIntent,
      stripeDisputeId: dispute.id,
      disputeStatus: dispute.status,
    })
    if (recorded.status === "not_found") {
      // Le litige peut précéder le fulfillment (Stripe livre
      // `charge.dispute.created` avant `checkout.session.completed` avec la
      // carte de test, et un paiement différé peut être contesté avant d'être
      // confirmé) : la transaction est encore `pending`, sans payment_intent.
      // Sa session Checkout, elle, existe depuis le pending. Une erreur Stripe
      // ici remonte à la route → 500 → retry.
      const session = await findCheckoutSessionByPaymentIntent(
        disputedPaymentIntent,
      )
      if (session) {
        recorded = await recordStripeDispute({
          stripePaymentIntentId: disputedPaymentIntent,
          stripeSessionId: session.id,
          stripeDisputeId: dispute.id,
          disputeStatus: dispute.status,
        })
      }
    }
    if (recorded.status === "not_found") {
      captureServerError(
        "[stripe:webhook]",
        new Error("litige sans transaction correspondante"),
        { detail },
      )
    }
  }

  // Litige perdu : les fonds sont partis, le service est retiré. Idempotent au
  // rejeu (Stripe redélivre, et un événement peut être renvoyé depuis le
  // Dashboard). L'alerte « litige perdu » est déjà partie plus haut ; celle-ci
  // ne porte que l'issue du retrait.
  if (
    event.type === "charge.dispute.closed" &&
    dispute.status === "lost" &&
    disputedPaymentIntent
  ) {
    const refund = await refundStripeTransaction({
      stripePaymentIntentId: disputedPaymentIntent,
      refundedAt: new Date(event.created * 1000),
    })
    captureServerError(
      "[stripe:webhook]",
      new Error("litige perdu · retrait d'accès"),
      { detail: `${detail} · ${describeRefund(refund)}` },
    )
  }
  return {}
}

// Remboursement depuis le Dashboard (ou remboursement proactif après EFW) :
// COMPLET → la transaction passe en refunded et l'accès est recalculé ;
// PARTIEL → geste commercial, accès conservé, alerte seule. Stripe = source de
// vérité pour l'argent, comme pour l'octroi. L'alerte part AVANT l'écriture
// (même règle que les litiges).
const fulfilRefund = async (
  event: Stripe.Event,
  charge: Stripe.Charge,
): Promise<Fulfillment> => {
  const paymentIntent = paymentIntentIdOf(charge.payment_intent)
  const detail = `charge ${charge.id} · ${charge.amount_refunded}/${charge.amount} ${charge.currency} · payment_intent ${paymentIntent ?? "absent"}`

  if (!paymentIntent) {
    captureServerError(
      "[stripe:webhook]",
      new Error("remboursement sans payment_intent"),
      { detail },
    )
    return {}
  }
  if (!charge.refunded) {
    captureServerError(
      "[stripe:webhook]",
      new Error("remboursement partiel, accès conservé"),
      { detail },
    )
    return {}
  }

  captureServerError(
    "[stripe:webhook]",
    new Error("remboursement Stripe complet"),
    { detail },
  )
  const refund = await refundStripeTransaction({
    stripePaymentIntentId: paymentIntent,
    refundedAt: new Date(event.created * 1000),
  })
  reportRefundOutcome(refund, detail)
  return {}
}

/**
 * Fulfillment d'un événement Stripe VÉRIFIÉ : octroi, échec, litige,
 * remboursement, signal de fraude — décidé par `event.type`, indépendant du
 * transport HTTP. Les alertes partent inline, AVANT toute écriture en base
 * (`.claude/rules/payments.md`). Une erreur inattendue LÈVE : la route
 * l'attrape, la capture et répond 500 pour que Stripe rejoue. Un événement
 * non géré rend `{}` (acquitté sans traitement).
 */
export async function fulfilStripeEvent(
  event: Stripe.Event,
): Promise<Fulfillment> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return fulfilCheckout(event, event.data.object as Stripe.Checkout.Session)

    // Panier abandonné : seule l'expiration de la session Checkout (24 h sans
    // paiement) vaut abandon. Le rappel part APRÈS l'acquittement, comme la
    // confirmation ; un rejeu Stripe retombe en `already_processed`.
    case "checkout.session.expired": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      const result = await failStripeTransaction({
        stripeSessionId: checkoutSession.id,
        stripeEventId: event.id,
      })
      if (result.status !== "failed") return {}
      const { transactionId } = result
      return {
        deferred: async () => {
          await sendAbandonedCartReminder(transactionId)
        },
      }
    }

    // `async_payment_failed` : le paiement différé n'a jamais abouti. La
    // transaction est restée `pending` (aucun fulfillment sur `unpaid`), et
    // `failStripeTransaction` garde son UPDATE sur ce statut — un `completed`
    // ne peut donc pas être révoqué par cette branche.
    case "checkout.session.async_payment_failed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      await failStripeTransaction({
        stripeSessionId: checkoutSession.id,
        stripeEventId: event.id,
      })
      return {}
    }

    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
    case "charge.dispute.funds_reinstated":
      return fulfilDispute(event, event.data.object as Stripe.Dispute)

    case "charge.refunded":
      return fulfilRefund(event, event.data.object as Stripe.Charge)

    // Signal des réseaux AVANT le litige : Stripe indique que 80 % des EFW
    // deviennent un litige si rien n'est fait. Rembourser proactivement évite
    // les frais de litige et le coup au taux de litige.
    case "radar.early_fraud_warning.created": {
      const warning = event.data.object as Stripe.Radar.EarlyFraudWarning
      const chargeId =
        typeof warning.charge === "string" ? warning.charge : warning.charge.id
      const paymentIntent = paymentIntentIdOf(warning.payment_intent)
      captureServerError(
        "[stripe:webhook]",
        new Error("signal de fraude avant litige (early fraud warning)"),
        {
          detail: `efw ${warning.id} · charge ${chargeId} · type ${warning.fraud_type} · payment_intent ${paymentIntent ?? "absent"} · remboursement proactif à envisager`,
        },
      )
      return {}
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.warn(
        "[stripe webhook] paiement échoué",
        paymentIntent.id,
        paymentIntent.last_payment_error?.message,
      )
      return {}
    }

    default:
      return {}
  }
}
