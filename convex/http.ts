import type { WebhookEvent } from "@clerk/backend"
import { httpRouter } from "convex/server"
import Stripe from "stripe"
import { Webhook } from "svix"
import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"

const http = httpRouter()

http.route({
  path: "/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request)
    if (!event) {
      return new Response("Error occured while calling webhook", {
        status: 400,
      })
    }
    switch (event.type) {
      case "user.created":
        await ctx.runMutation(internal.users.createUser, {
          externalId: event.data.id,
          tokenIdentifier: `${process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL}|${event.data.id}`,
          name: `${event.data.first_name ?? "Guest"} ${event.data.last_name ?? ""}`,
          role: "user",
          email:
            event.data.email_addresses[0]?.email_address ?? "test@example.com",
          image: event.data.image_url,
        })
        break

      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        })
        break

      case "user.deleted": {
        const clerkUserId = event.data.id!
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId })
        break
      }

      default:
        console.log("Ignored Clerk webhook event", event.type)
    }

    return new Response(null, { status: 200 })
  }),
})

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text()
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  }
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent
  } catch (error) {
    console.error("Error verifying webhook event", error)
    return null
  }
}

// ============================================
// STRIPE WEBHOOK
// ============================================

http.route({
  path: "/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripeSecretKey || !webhookSecret) {
      console.error("Missing Stripe configuration")
      return new Response("Server configuration error", { status: 500 })
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    })

    const signature = request.headers.get("stripe-signature")
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 })
    }

    const body = await request.text()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return new Response("Webhook signature verification failed", { status: 400 })
    }

    // Traiter les événements Stripe
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.payment_status === "paid") {
          try {
            await ctx.runMutation(internal.payments.completeStripeTransaction, {
              stripeSessionId: session.id,
              stripePaymentIntentId: (session.payment_intent as string) || "",
              stripeEventId: event.id,
            })
            console.log("Transaction completed for session:", session.id)
          } catch (error) {
            console.error("Error completing transaction:", error)
            // Retourner 200 quand même pour éviter les retries Stripe
            // L'erreur est loggée pour investigation
          }
        }
        break
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session

        try {
          await ctx.runMutation(internal.payments.failStripeTransaction, {
            stripeSessionId: session.id,
            stripeEventId: event.id,
          })
          console.log("Transaction marked as failed for session:", session.id)
        } catch (error) {
          console.error("Error failing transaction:", error)
        }
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(
          "Payment failed for intent:",
          paymentIntent.id,
          "Error:",
          paymentIntent.last_payment_error?.message,
        )
        break
      }

      default:
        console.log("Unhandled Stripe event type:", event.type)
    }

    return new Response(null, { status: 200 })
  }),
})

export default http
