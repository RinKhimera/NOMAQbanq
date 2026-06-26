import "server-only"
import Stripe from "stripe"
import { env } from "@/lib/env/server"

/**
 * Version d'API Stripe centralisée (alignée sur le SDK `stripe` installé).
 * Mettre à jour ici lors d'une montée de version du package.
 */
export const STRIPE_API_VERSION = "2026-06-24.dahlia" as const

let client: Stripe | null = null

/** Client Stripe (singleton). Lève si `STRIPE_SECRET_KEY` absent. */
export function getStripe(): Stripe {
  if (client) return client
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Configuration Stripe manquante (STRIPE_SECRET_KEY)")
  }
  client = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  })
  return client
}

/** Secret de signature des webhooks Stripe. Lève si absent. */
export function getStripeWebhookSecret(): string {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Configuration Stripe manquante (STRIPE_WEBHOOK_SECRET)")
  }
  return env.STRIPE_WEBHOOK_SECRET
}
