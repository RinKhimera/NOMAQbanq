import type Stripe from "stripe"
import { vi } from "vitest"
import type * as stripe from "@/lib/stripe"
import type { StripeCheckoutSession, StripePrice } from "@/lib/stripe"

/** Port Stripe : la surface exportée de `@/lib/stripe`, et rien d'autre. */
export type StripePort = typeof stripe

type Verb = keyof StripePort

export type StripeCall = { verb: Verb; input: unknown }

/**
 * Session Checkout telle que le faux la connaît : ce que `retrieveCheckoutSession`
 * rend, plus le `payment_intent` qui l'indexe pour
 * `findCheckoutSessionByPaymentIntent`.
 */
export type FakeCheckoutSession = StripeCheckoutSession & {
  payment_intent?: string
}

const calls: StripeCall[] = []
const failures = new Map<Verb, Error>()
const prices: StripePrice[] = []
const checkoutSessions = new Map<string, FakeCheckoutSession>()
const customers = new Map<string, { id: string }>()
const events: Stripe.Event[] = []
let createdSessions = 0

/**
 * Boîte du faux : les appels reçus (verbe + entrée exacte), de quoi faire
 * échouer le prochain appel d'un verbe, et l'état que les verbes de lecture
 * consultent. `reset()` entre deux tests.
 */
export const stripeBox = {
  calls,
  /** Prix actifs que `listActivePrices` filtre par `lookup_key`. */
  prices,
  /** Sessions Checkout par id (`retrieveCheckoutSession`, repli par `payment_intent`). */
  checkoutSessions,
  /** Customers par courriel (`findCustomerByEmail`). */
  customers,
  failNext(verb: Verb, error: Error) {
    failures.set(verb, error)
  },
  /** Événement que le prochain `verifyWebhook` rend ; sans événement posé, il lève. */
  nextEvent(event: unknown) {
    events.push(event as Stripe.Event)
  },
  seedCheckoutSession(
    session: Partial<FakeCheckoutSession> & { id: string },
  ): FakeCheckoutSession {
    const full: FakeCheckoutSession = {
      payment_status: "paid",
      amount_total: null,
      currency: null,
      customer_email: null,
      metadata: {},
      ...session,
    }
    checkoutSessions.set(full.id, full)
    return full
  },
  reset() {
    calls.length = 0
    failures.clear()
    prices.length = 0
    checkoutSessions.clear()
    customers.clear()
    events.length = 0
    createdSessions = 0
  },
}

const verb = <K extends Verb>(
  name: K,
  respond: (
    ...input: Parameters<StripePort[K]>
  ) => Awaited<ReturnType<StripePort[K]>>,
) =>
  vi.fn(
    async (
      ...input: Parameters<StripePort[K]>
    ): Promise<Awaited<ReturnType<StripePort[K]>>> => {
      calls.push({ verb: name, input: input.length === 1 ? input[0] : input })
      const failure = failures.get(name)
      if (failure) {
        failures.delete(name)
        throw failure
      }
      return respond(...input)
    },
  )

/**
 * Remplace `@/lib/stripe` en test : `vi.mock("@/lib/stripe", () =>
 * import("../helpers/fake-stripe").then((m) => m.fakeStripe))`.
 * `satisfies StripePort` : un verbe ajouté au port sans son faux ne compile plus.
 */
export const fakeStripe = {
  verifyWebhook: verb("verifyWebhook", () => {
    const event = events.shift()
    if (!event) throw new Error("Webhook signature verification failed")
    return event
  }),
  listActivePrices: verb("listActivePrices", (lookupKeys) =>
    prices.filter((p) => p.lookup_key && lookupKeys.includes(p.lookup_key)),
  ),
  findCheckoutSessionByPaymentIntent: verb(
    "findCheckoutSessionByPaymentIntent",
    (paymentIntentId) => {
      for (const session of checkoutSessions.values()) {
        if (session.payment_intent === paymentIntentId) {
          return { id: session.id }
        }
      }
      return null
    },
  ),
  createCheckoutSession: verb("createCheckoutSession", (params) => {
    const n = ++createdSessions
    const session = stripeBox.seedCheckoutSession({
      id: `cs_test_${n}`,
      payment_status: "unpaid",
      customer_email: params.customer_email ?? null,
      metadata: Object.fromEntries(
        Object.entries(params.metadata ?? {}).map(([k, v]) => [k, String(v)]),
      ),
    })
    return { id: session.id, url: `https://checkout.stripe.test/${n}` }
  }),
  retrieveCheckoutSession: verb("retrieveCheckoutSession", (id) => {
    const s = checkoutSessions.get(id)
    if (!s) return null
    return {
      id: s.id,
      payment_status: s.payment_status,
      amount_total: s.amount_total,
      currency: s.currency,
      customer_email: s.customer_email,
      metadata: s.metadata,
    }
  }),
  findCustomerByEmail: verb(
    "findCustomerByEmail",
    (email) => customers.get(email) ?? null,
  ),
  createPortalSession: verb("createPortalSession", () => ({
    url: "https://billing.stripe.test/portal",
  })),
} satisfies StripePort
