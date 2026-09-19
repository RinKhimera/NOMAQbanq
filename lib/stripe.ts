import "server-only"
import Stripe from "stripe"
import { env } from "@/lib/env/server"
import { STRIPE_API_VERSION } from "@/lib/stripe-api-version"
import { StripeConfigurationError } from "@/lib/stripe-errors"

/**
 * Port Stripe : les verbes que l'application demande à Stripe, typés sur ce
 * qu'elle lit, et rien d'autre. Ce module EST l'adaptateur SDK ; en test, il
 * se remplace en bloc par `tests/helpers/fake-stripe.ts` (`satisfies
 * StripePort`), jamais par un mock partiel.
 *
 * Requêtes bornées à la construction. Le SDK attend 80 s par défaut et
 * réessaie 2 fois : un appel qui pend peut donc durer ~4 min. Inacceptable sur
 * le chemin du checkout et du portail, où l'utilisateur attend, comme dans le
 * cron, dont l'appelant coupe à `--max-time 60` puis relance — soit jusqu'à
 * 4 exécutions complètes par heure.
 */
let client: Stripe | null = null

const sdk = (): Stripe => {
  if (client) return client
  if (!env.STRIPE_SECRET_KEY) {
    throw new StripeConfigurationError("STRIPE_SECRET_KEY")
  }
  client = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    timeout: 8000,
    maxNetworkRetries: 1,
  })
  return client
}

// Duck-check (évite d'importer les classes d'erreur Stripe pour un seul code).
const isResourceMissing = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "resource_missing"

export type StripePrice = Pick<
  Stripe.Price,
  "id" | "unit_amount" | "currency" | "lookup_key"
>

export type StripeCheckoutSession = Pick<
  Stripe.Checkout.Session,
  | "id"
  | "payment_status"
  | "amount_total"
  | "currency"
  | "customer_email"
  | "metadata"
>

/**
 * Vérifie la signature d'un webhook et rend l'événement. Lève sur signature
 * invalide ; lève `StripeConfigurationError` si le secret ou la clé manquent.
 */
export async function verifyWebhook(
  body: string,
  signature: string,
): Promise<Stripe.Event> {
  const stripe = sdk()
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new StripeConfigurationError("STRIPE_WEBHOOK_SECRET")
  }
  return stripe.webhooks.constructEventAsync(
    body,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  )
}

/**
 * Prix actifs portant l'une des `lookupKeys` (au plus 10 par appel, borne de
 * l'API). `limit: 100` et PAS le nombre de clés : une clé peut porter plusieurs
 * prix actifs, donc la réponse peut compter plus de lignes que de clés. Un
 * `limit` égal au nombre de clés tronquerait alors la liste, et les clés
 * absentes du tronçon passeraient pour « sans prix actif ». 100 est le maximum
 * accepté par l'API.
 */
export async function listActivePrices(
  lookupKeys: string[],
): Promise<StripePrice[]> {
  const { data } = await sdk().prices.list({
    lookup_keys: lookupKeys,
    active: true,
    limit: 100,
  })
  return data
}

/** Session Checkout à l'origine d'un `payment_intent`, `null` si aucune. */
export async function findCheckoutSessionByPaymentIntent(
  paymentIntentId: string,
): Promise<{ id: string } | null> {
  const { data } = await sdk().checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 1,
  })
  return data[0] ? { id: data[0].id } : null
}

export async function createCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
): Promise<{ id: string; url: string | null }> {
  const session = await sdk().checkout.sessions.create(params)
  return { id: session.id, url: session.url }
}

/**
 * `null` si la session n'existe pas (`resource_missing`) : un `session_id`
 * d'URL périmé ou forgé est un flux métier, pas une erreur.
 */
export async function retrieveCheckoutSession(
  id: string,
): Promise<StripeCheckoutSession | null> {
  try {
    const s = await sdk().checkout.sessions.retrieve(id)
    return {
      id: s.id,
      payment_status: s.payment_status,
      amount_total: s.amount_total,
      currency: s.currency,
      customer_email: s.customer_email,
      metadata: s.metadata,
    }
  } catch (error) {
    if (isResourceMissing(error)) return null
    throw error
  }
}

export async function findCustomerByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const { data } = await sdk().customers.list({ email, limit: 1 })
  return data[0] ? { id: data[0].id } : null
}

export async function createPortalSession(params: {
  customer: string
  return_url: string
}): Promise<{ url: string }> {
  const portal = await sdk().billingPortal.sessions.create(params)
  return { url: portal.url }
}
