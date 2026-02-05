/**
 * Stripe Actions pour NOMAQbanq
 *
 * Ce fichier contient les actions Convex pour interagir avec l'API Stripe.
 * Les actions sont nécessaires car elles peuvent faire des appels HTTP externes.
 *
 * Installation requise: npm install stripe
 */
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { action } from "./_generated/server"
import { Errors } from "./lib/errors"
import { getStripe } from "./lib/stripe"

// ============================================
// TYPE DEFINITIONS
// ============================================

const productCodeValidator = v.union(
  v.literal("exam_access"),
  v.literal("training_access"),
  v.literal("exam_access_promo"),
  v.literal("training_access_promo"),
  v.literal("premium_access"),
)

// ============================================
// ACTIONS - Checkout
// ============================================

/**
 * Crée une session Stripe Checkout
 * Retourne l'URL de redirection vers la page de paiement Stripe
 */
export const createCheckoutSession = action({
  args: {
    productCode: productCodeValidator,
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ checkoutUrl: string | null; sessionId: string }> => {
    // Vérifier l'authentification
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw Errors.unauthenticated()
    }

    // Récupérer l'utilisateur
    const user = (await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })) as { _id: Id<"users">; email: string } | null

    if (!user) {
      throw new Error("Utilisateur non trouvé")
    }

    // Récupérer le produit
    const product = (await ctx.runQuery(internal.payments.getProductByCode, {
      code: args.productCode,
    })) as {
      _id: Id<"products">
      stripePriceId: string
      priceCAD: number
      accessType: "exam" | "training"
      durationDays: number
      isActive: boolean
      isCombo?: boolean
    } | null

    if (!product) {
      throw new Error("Produit non trouvé: " + args.productCode)
    }

    if (!product.isActive) {
      throw new Error("Ce produit n'est plus disponible")
    }

    const stripe = getStripe()

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      // Forcer la création d'un customer Stripe pour le portail de facturation
      customer_creation: "always",
      line_items: [
        {
          price: product.stripePriceId,
          quantity: 1,
        },
      ],
      // Metadata pour le traitement webhook
      metadata: {
        userId: user._id,
        productId: product._id,
        productCode: args.productCode,
        accessType: product.accessType,
        durationDays: product.durationDays.toString(),
        isCombo: product.isCombo ? "true" : "false",
      },
      success_url: args.successUrl + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: args.cancelUrl,
      // Permettre les codes promo si configurés dans Stripe
      allow_promotion_codes: true,
    })

    // Créer la transaction en attente dans la base de données
    await ctx.runMutation(internal.payments.createPendingTransaction, {
      userId: user._id,
      productId: product._id,
      stripeSessionId: session.id,
      amountPaid: product.priceCAD,
      currency: "CAD",
      accessType: product.accessType,
      durationDays: product.durationDays,
      isCombo: product.isCombo,
    })

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    }
  },
})

/**
 * Vérifie le statut d'une session checkout (pour la page de succès)
 */
export const verifyCheckoutSession = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Vous devez être connecté pour vérifier un paiement")
    }

    const stripe = getStripe()

    try {
      const session = await stripe.checkout.sessions.retrieve(args.sessionId)

      return {
        success: session.payment_status === "paid",
        status: session.payment_status,
        customerEmail: session.customer_email,
        metadata: session.metadata,
        amountTotal: session.amount_total,
        currency: session.currency,
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de la session:", error)
      return {
        success: false,
        error: "Session non trouvée ou invalide",
      }
    }
  },
})

/**
 * Crée une session pour le portail client Stripe
 * Permet aux utilisateurs de gérer leurs factures et moyens de paiement
 */
export const createCustomerPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ portalUrl: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Non authentifié")
    }

    const user = (await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })) as { _id: string; email: string } | null

    if (!user) {
      throw new Error("Utilisateur non trouvé")
    }

    const stripe = getStripe()

    // Rechercher le client Stripe par email
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    })

    if (customers.data.length === 0) {
      throw new Error("Aucun historique de paiement trouvé")
    }

    const customerId = customers.data[0].id

    // Créer la session portail
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: args.returnUrl,
    })

    return {
      portalUrl: session.url,
    }
  },
})

/**
 * [Admin] Récupère les détails d'un paiement Stripe
 */
export const getPaymentDetails = action({
  args: {
    paymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Vérifier que l'utilisateur est admin
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Non authentifié")
    }

    const user = (await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })) as { _id: string; role: string } | null

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

    const stripe = getStripe()

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        args.paymentIntentId,
      )

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: paymentIntent.created,
        metadata: paymentIntent.metadata,
        paymentMethod: paymentIntent.payment_method,
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du paiement:", error)
      return {
        error: "Paiement non trouvé",
      }
    }
  },
})
