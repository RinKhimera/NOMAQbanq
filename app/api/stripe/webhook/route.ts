import type Stripe from "stripe"
import {
  completeStripeTransaction,
  failStripeTransaction,
} from "@/features/payments/stripe"
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe"

// Le SDK Stripe nécessite le runtime Node (pas Edge).
export const runtime = "nodejs"

// Une session promo 100 % est complétée avec `no_payment_required` (montant nul,
// pas de PaymentIntent) : elle doit accorder l'accès au même titre qu'un `paid`.
const FULFILLABLE_PAYMENT_STATUSES: ReadonlyArray<Stripe.Checkout.Session.PaymentStatus> =
  ["paid", "no_payment_required"]

/**
 * Webhook Stripe (remplace la route Convex `/stripe`). Vérifie la signature, puis
 * délègue le fulfillment idempotent au DAL. Conventions de réponse :
 * - 400 : signature absente/invalide (jamais rejoué).
 * - 500 : erreur inattendue (DB…) → Stripe RÉESSAIE (≠ Convex qui avalait tout en
 *   200 et perdait le fulfillment sur erreur transitoire).
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
    console.error("[stripe webhook] configuration manquante", error)
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
      case "checkout.session.completed": {
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
            // Montant/devise réellement facturés (promo, Adaptive Pricing).
            amountTotal: checkoutSession.amount_total,
            currency: checkoutSession.currency,
          })
          if (result.status === "not_found") {
            console.error(
              "[stripe webhook] aucune transaction pour la session",
              checkoutSession.id,
            )
          }
        }
        break
      }

      case "checkout.session.expired": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        await failStripeTransaction({
          stripeSessionId: checkoutSession.id,
          stripeEventId: event.id,
        })
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
    console.error("[stripe webhook] erreur de traitement", event.type, error)
    return new Response("Webhook handler error", { status: 500 })
  }

  return new Response(null, { status: 200 })
}
