import type Stripe from "stripe"
import {
  completeStripeTransaction,
  failStripeTransaction,
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
      // Traitement humain (aucune révocation automatique d'accès).
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute
        // Le `payment_intent` est la SEULE clé qui relie le litige à un client :
        // il rejoint `transactions.stripe_payment_intent_id`. Sans lui, l'alerte
        // n'identifie personne et il faut passer par le dashboard Stripe pour
        // savoir qui conteste — du temps perdu sur une fenêtre de réponse
        // limitée.
        const disputedPaymentIntent =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id
        captureServerError(
          "[stripe:webhook]",
          new Error("litige ouvert sur un paiement Stripe"),
          {
            detail: `dispute ${dispute.id} · ${dispute.amount} ${dispute.currency} · motif ${dispute.reason} · payment_intent ${disputedPaymentIntent ?? "absent"}`,
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
