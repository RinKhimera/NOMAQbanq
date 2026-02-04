import Stripe from "stripe"

/**
 * Version de l'API Stripe centralisée.
 * Mettre à jour ici lors des mises à jour du package stripe.
 */
export const STRIPE_API_VERSION = "2026-01-28.clover" as const

/**
 * Crée une instance Stripe configurée.
 * @throws Error si STRIPE_SECRET_KEY n'est pas défini
 */
export function getStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error("Configuration Stripe manquante")
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}
