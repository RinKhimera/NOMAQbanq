import { waitUntil } from "@vercel/functions"
import type Stripe from "stripe"
import { sendPurchaseConfirmationEmail } from "@/email"
import {
  type CompleteStripeResult,
  completeStripeTransaction,
  failStripeTransaction,
  markConfirmationEmailSent,
  recordStripeDispute,
} from "@/features/payments/stripe"
import { captureServerError } from "@/lib/observability"
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe"

// Le SDK Stripe nécessite le runtime Node (pas Edge).
export const runtime = "nodejs"

// Une session promo 100 % est complétée avec `no_payment_required` (montant nul,
// pas de PaymentIntent) : elle doit accorder l'accès au même titre qu'un `paid`.
const FULFILLABLE_PAYMENT_STATUSES: ReadonlyArray<Stripe.Checkout.Session.PaymentStatus> =
  ["paid", "no_payment_required"]

/**
 * Webhook Stripe. Vérifie la signature, puis
 * délègue le fulfillment idempotent au DAL. Conventions de réponse :
 * - 400 : signature absente/invalide (jamais rejoué).
 * - 500 : erreur inattendue (DB…) → Stripe RÉESSAIE (ne jamais acquitter en 200 :
 *   le fulfillment serait perdu sur erreur transitoire).
 * - 200 : événement traité ou volontairement ignoré.
 *
 * ⚠️ Config déploiement : pointer l'endpoint webhook du dashboard Stripe vers
 * `/api/stripe/webhook` et renseigner `STRIPE_WEBHOOK_SECRET`.
 */
/**
 * Courriel de confirmation, APRÈS le 200 et en best-effort. Stripe exige une
 * réponse rapide avant toute logique longue ; `sendEmail` fait deux rendus
 * React Email puis un appel SES, et un dépassement de délai déclencherait un
 * retry qui retomberait en `already_processed` — courriel perdu sans trace.
 * L'accès est déjà COMMITÉ quand on arrive ici : un échec ne change rien au
 * fulfillment. Le reçu Stripe (`receipt_email`) part de son côté. Sentry est
 * la seule trace d'un échec.
 */
const sendConfirmation = async (
  result: Extract<CompleteStripeResult, { status: "completed" }>,
) => {
  const c = result.confirmation
  try {
    if (!c.userEmail) {
      throw new Error("compte anonymisé, aucun destinataire")
    }
    const messageId = await sendPurchaseConfirmationEmail({
      to: c.userEmail,
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

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 })
  }

  let stripe: Stripe
  let webhookSecret: string
  try {
    stripe = getStripe()
    webhookSecret = getStripeWebhookSecret()
  } catch (error) {
    captureServerError("[stripe:webhook]", error, { detail: "configuration" })
    return new Response("Server configuration error", { status: 500 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    )
  } catch (error) {
    console.error("[stripe webhook] signature invalide", error)
    return new Response("Webhook signature verification failed", {
      status: 400,
    })
  }

  try {
    switch (event.type) {
      // Un moyen de paiement différé (virement, prélèvement) complète la session
      // en `unpaid` puis confirme des heures/jours plus tard par un second
      // événement : sans cette branche, ces clients paient sans jamais recevoir
      // l'accès. Même chemin d'octroi (idempotent), donc un `completed` suivi
      // d'un `async_payment_succeeded` ne crédite qu'une fois.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        if (
          FULFILLABLE_PAYMENT_STATUSES.includes(checkoutSession.payment_status)
        ) {
          const result = await completeStripeTransaction({
            stripeSessionId: checkoutSession.id,
            stripePaymentIntentId:
              typeof checkoutSession.payment_intent === "string"
                ? checkoutSession.payment_intent
                : "",
            stripeEventId: event.id,
            // Montant réellement facturé : un code promo fait diverger
            // `amount_total` du prix catalogue. (Adaptive Pricing, lui, ne change
            // PAS la devise de la session — voir `presentment_details` juste en
            // dessous.)
            amountTotal: checkoutSession.amount_total,
            currency: checkoutSession.currency,
            // Ce que le client a réellement vu et payé dans sa devise locale.
            presentmentAmount:
              checkoutSession.presentment_details?.presentment_amount,
            presentmentCurrency:
              checkoutSession.presentment_details?.presentment_currency,
          })
          if (result.status === "not_found") {
            // Transaction fantôme (payé sans pending en base) : anomalie réelle,
            // mais 200 conservé — rejouer l'événement ne la fera pas apparaître.
            captureServerError(
              "[stripe:webhook]",
              new Error("aucune transaction pour la session Stripe"),
              { detail: `session ${checkoutSession.id}` },
            )
          }
          if (result.status === "completed") {
            waitUntil(sendConfirmation(result))
          }
        }
        break
      }

      // `async_payment_failed` : le paiement différé n'a jamais abouti. La
      // transaction est restée `pending` (aucun fulfillment sur `unpaid`), et
      // `failStripeTransaction` garde son UPDATE sur ce statut — un `completed`
      // ne peut donc pas être révoqué par cette branche.
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        await failStripeTransaction({
          stripeSessionId: checkoutSession.id,
          stripeEventId: event.id,
        })
        break
      }

      // Un litige prélève la somme + des frais et ouvre une fenêtre de réponse
      // limitée : sans alerte, elle se referme sans que personne ne l'ait vue.
      // Traitement humain (aucune révocation automatique d'accès : couper
      // l'accès affaiblirait la position « service livré et utilisé »).
      // L'alerte part AVANT l'écriture en base : une panne Neon ne doit pas
      // la priver de son détail.
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_reinstated": {
        const dispute = event.data.object as Stripe.Dispute
        // Le `payment_intent` est la SEULE clé qui relie le litige à un client :
        // il rejoint `transactions.stripe_payment_intent_id`.
        const disputedPaymentIntent =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id
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
          captureServerError("[stripe:webhook]", new Error(outcome), {
            detail,
          })
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
            // `charge.dispute.created` avant `checkout.session.completed` avec
            // la carte de test, et un paiement différé peut être contesté avant
            // d'être confirmé) : la transaction est encore `pending`, sans
            // payment_intent. Sa session Checkout, elle, existe depuis le
            // pending. Une erreur Stripe ici remonte au catch → 500 → retry.
            const sessions = await stripe.checkout.sessions.list({
              payment_intent: disputedPaymentIntent,
              limit: 1,
            })
            const sessionId = sessions.data[0]?.id
            if (sessionId) {
              recorded = await recordStripeDispute({
                stripePaymentIntentId: disputedPaymentIntent,
                stripeSessionId: sessionId,
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
        break
      }

      // Signal des réseaux AVANT le litige : Stripe indique que 80 % des EFW
      // deviennent un litige si rien n'est fait. Rembourser proactivement évite
      // les frais de litige et le coup au taux de litige.
      case "radar.early_fraud_warning.created": {
        const warning = event.data.object as Stripe.Radar.EarlyFraudWarning
        const chargeId =
          typeof warning.charge === "string"
            ? warning.charge
            : warning.charge.id
        const paymentIntent =
          typeof warning.payment_intent === "string"
            ? warning.payment_intent
            : warning.payment_intent?.id
        captureServerError(
          "[stripe:webhook]",
          new Error("signal de fraude avant litige (early fraud warning)"),
          {
            detail: `efw ${warning.id} · charge ${chargeId} · type ${warning.fraud_type} · payment_intent ${paymentIntent ?? "absent"} · remboursement proactif à envisager`,
          },
        )
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.warn(
          "[stripe webhook] paiement échoué",
          paymentIntent.id,
          paymentIntent.last_payment_error?.message,
        )
        break
      }

      default:
        // Événement non géré : acquitté (200) sans traitement.
        break
    }
  } catch (error) {
    // `onRequestError` ne voit jamais cette erreur (catchée puis convertie en
    // Response 500) : la capture explicite est la SEULE trace Sentry du
    // fulfillment. Le 500 → retry Stripe est le contrat, ne pas y toucher.
    captureServerError("[stripe:webhook]", error, { detail: event.type })
    return new Response("Webhook handler error", { status: 500 })
  }

  return new Response(null, { status: 200 })
}
