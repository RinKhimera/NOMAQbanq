import { after } from "next/server"
import type Stripe from "stripe"
import { fulfilStripeEvent } from "@/features/payments/fulfillment"
import { captureServerError } from "@/lib/observability"
import { verifyWebhook } from "@/lib/stripe"

// Le SDK Stripe nécessite le runtime Node (pas Edge).
export const runtime = "nodejs"

const isStripeConfigurationError = (error: unknown): boolean =>
  error instanceof Error && error.name === "StripeConfigurationError"

/**
 * Webhook Stripe : vérifie la signature (port Stripe), délègue le fulfillment
 * à `fulfilStripeEvent`, puis acquitte. Conventions de réponse :
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

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = await verifyWebhook(body, signature)
  } catch (error) {
    if (isStripeConfigurationError(error)) {
      captureServerError("[stripe:webhook]", error, { detail: "configuration" })
      return new Response("Server configuration error", { status: 500 })
    }
    console.error("[stripe webhook] signature invalide", error)
    return new Response("Webhook signature verification failed", {
      status: 400,
    })
  }

  try {
    const { deferred } = await fulfilStripeEvent(event)
    // `after` de Next : exécuté après l'envoi de la réponse, avec un repli
    // local (contrairement à `waitUntil` de `@vercel/functions`, qui est un
    // no-op silencieux hors Vercel).
    if (deferred) after(deferred)
  } catch (error) {
    // `onRequestError` ne voit jamais cette erreur (catchée puis convertie en
    // Response 500) : la capture explicite est la SEULE trace Sentry du
    // fulfillment. Le 500 → retry Stripe est le contrat, ne pas y toucher.
    captureServerError("[stripe:webhook]", error, { detail: event.type })
    return new Response("Webhook handler error", { status: 500 })
  }

  return new Response(null, { status: 200 })
}
