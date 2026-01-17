import type { WebhookEvent } from "@clerk/backend"
import { httpRouter } from "convex/server"
import Stripe from "stripe"
import { Webhook } from "svix"
import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"
import {
  deleteFromBunny,
  generateAvatarPath,
  generateQuestionImagePath,
  getExtensionFromMimeType,
  uploadToBunny,
  validateImageFile,
} from "./lib/bunny"

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
      // Use async version for Convex edge runtime compatibility
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
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

// ============================================
// BUNNY UPLOAD ROUTES
// ============================================

// CORS headers pour les routes d'upload
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

const jsonResponseHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
}

// Helper pour créer une réponse JSON avec CORS
const jsonResponse = (data: object, status: number = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: jsonResponseHeaders,
  })

// OPTIONS preflight pour question-image
http.route({
  path: "/api/upload/question-image",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }),
})

/**
 * Upload image pour une question (admin seulement)
 * POST /api/upload/question-image
 * Body: FormData avec "file" et "questionId"
 */
http.route({
  path: "/api/upload/question-image",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Vérifier l'authentification et le rôle admin
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return jsonResponse({ error: "Non authentifié" }, 401)
    }

    // Vérifier le rôle admin
    const user = await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })
    if (!user || user.role !== "admin") {
      return jsonResponse({ error: "Accès non autorisé" }, 403)
    }

    try {
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      const questionId = formData.get("questionId") as string | null
      const imageIndex = parseInt(formData.get("imageIndex") as string) || 0

      if (!file) {
        return jsonResponse({ error: "Fichier manquant" }, 400)
      }

      if (!questionId) {
        return jsonResponse({ error: "questionId manquant" }, 400)
      }

      // Valider le fichier
      const validationError = validateImageFile(file.type, file.size)
      if (validationError) {
        return jsonResponse({ error: validationError }, 400)
      }

      // Générer le chemin de stockage
      const extension = getExtensionFromMimeType(file.type)
      const storagePath = generateQuestionImagePath(questionId, imageIndex, extension)

      // Upload vers Bunny
      const fileBuffer = await file.arrayBuffer()
      const result = await uploadToBunny(fileBuffer, storagePath)

      if (!result.success) {
        return jsonResponse({ error: result.error }, 500)
      }

      return jsonResponse({
        success: true,
        url: result.url,
        storagePath: result.storagePath,
      })
    } catch (error) {
      console.error("Question image upload error:", error)
      return jsonResponse({ error: "Erreur lors de l'upload" }, 500)
    }
  }),
})

// OPTIONS preflight pour avatar
http.route({
  path: "/api/upload/avatar",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }),
})

/**
 * Upload avatar utilisateur
 * POST /api/upload/avatar
 * Body: FormData avec "file"
 */
http.route({
  path: "/api/upload/avatar",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Vérifier l'authentification
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return jsonResponse({ error: "Non authentifié" }, 401)
    }

    // Récupérer l'utilisateur
    const user = await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })
    if (!user) {
      return jsonResponse({ error: "Utilisateur non trouvé" }, 404)
    }

    try {
      const formData = await request.formData()
      const file = formData.get("file") as File | null

      if (!file) {
        return jsonResponse({ error: "Fichier manquant" }, 400)
      }

      // Valider le fichier
      const validationError = validateImageFile(file.type, file.size)
      if (validationError) {
        return jsonResponse({ error: validationError }, 400)
      }

      // Supprimer l'ancien avatar si existant
      if (user.avatarStoragePath) {
        await deleteFromBunny(user.avatarStoragePath)
      }

      // Générer le chemin de stockage
      const extension = getExtensionFromMimeType(file.type)
      const storagePath = generateAvatarPath(user._id, extension)

      // Upload vers Bunny
      const fileBuffer = await file.arrayBuffer()
      const result = await uploadToBunny(fileBuffer, storagePath)

      if (!result.success) {
        return jsonResponse({ error: result.error }, 500)
      }

      // Mettre à jour le profil utilisateur avec le nouvel avatar
      await ctx.runMutation(internal.users.updateUserAvatar, {
        userId: user._id,
        avatarUrl: result.url,
        avatarStoragePath: result.storagePath,
      })

      return jsonResponse({
        success: true,
        url: result.url,
        storagePath: result.storagePath,
      })
    } catch (error) {
      console.error("Avatar upload error:", error)
      return jsonResponse({ error: "Erreur lors de l'upload" }, 500)
    }
  }),
})

/**
 * Supprimer une image de question (admin seulement)
 * DELETE /api/upload/question-image
 * Body: JSON avec "storagePath"
 */
http.route({
  path: "/api/upload/question-image",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    // Vérifier l'authentification et le rôle admin
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return jsonResponse({ error: "Non authentifié" }, 401)
    }

    const user = await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })
    if (!user || user.role !== "admin") {
      return jsonResponse({ error: "Accès non autorisé" }, 403)
    }

    try {
      const body = await request.json()
      const { storagePath } = body as { storagePath?: string }

      if (!storagePath) {
        return jsonResponse({ error: "storagePath manquant" }, 400)
      }

      // Supprimer de Bunny
      const deleted = await deleteFromBunny(storagePath)

      return jsonResponse({ success: deleted }, deleted ? 200 : 500)
    } catch (error) {
      console.error("Question image delete error:", error)
      return jsonResponse({ error: "Erreur lors de la suppression" }, 500)
    }
  }),
})

export default http
