import { and, eq, inArray } from "drizzle-orm"
import type Stripe from "stripe"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { fulfilStripeEvent } from "@/features/payments/fulfillment"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
import { fakeMailer, mailbox } from "../helpers/fake-mailer"
import { stripeBox } from "../helpers/fake-stripe"

// Fulfillment de bout en bout sur une vraie base, pour les chemins qui coûtent
// de l'argent : octroi, idempotence, litige avant fulfillment, remboursement
// complet vs partiel, litige perdu. La table exhaustive des événements (35 cas
// sur verbes mockés) vit dans tests/features/stripe-fulfillment.test.ts.
vi.mock("@/lib/observability", () => ({ captureServerError: vi.fn() }))
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("@/email", () =>
  import("../helpers/fake-mailer").then((m) => m.fakeMailer),
)
vi.mock("@/lib/stripe", () =>
  import("../helpers/fake-stripe").then((m) => m.fakeStripe),
)

const DAY = 24 * 60 * 60 * 1000
const DURATION_DAYS = 90
const suffix = createId().slice(0, 8)
const PRODUCT_ID = createId()
const seededUsers: string[] = []

const fulfil = (event: unknown) => fulfilStripeEvent(event as Stripe.Event)

const newUser = async () => {
  const id = createId()
  await db.insert(user).values({
    id,
    name: `Fulfil ${id.slice(0, 6)}`,
    email: `fulfil-${id.slice(0, 6)}-${suffix}@test.invalid`,
  })
  seededUsers.push(id)
  return id
}

const seedPending = async (userId: string) => {
  const id = createId()
  await db.insert(transactions).values({
    id,
    userId,
    productId: PRODUCT_ID,
    type: "stripe",
    status: "pending",
    amountPaid: 5000,
    currency: "CAD",
    stripeSessionId: `cs_${id}`,
    accessType: "exam",
    durationDays: DURATION_DAYS,
    accessExpiresAt: new Date(Date.now() + DURATION_DAYS * DAY),
    createdAt: new Date(),
  })
  return { id, sessionId: `cs_${id}`, paymentIntent: `pi_${id}` }
}

const txRow = (id: string) =>
  db
    .select({
      status: transactions.status,
      completedAt: transactions.completedAt,
      refundedAt: transactions.refundedAt,
      eventId: transactions.stripeEventId,
      paymentIntent: transactions.stripePaymentIntentId,
      amountPaid: transactions.amountPaid,
      disputeId: transactions.stripeDisputeId,
      disputeStatus: transactions.disputeStatus,
      confirmationMessageId: transactions.confirmationEmailMessageId,
      confirmationSentAt: transactions.confirmationEmailSentAt,
    })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)
    .then((r) => r[0]!)

const examAccess = (userId: string) =>
  db
    .select({ expiresAt: userAccess.expiresAt })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, "exam")),
    )
    .limit(1)
    .then((r) => r[0] ?? null)

const checkoutEvent = (
  type:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded"
    | "checkout.session.expired",
  o: {
    eventId: string
    sessionId: string
    paymentIntent?: string
    paymentStatus?: "paid" | "unpaid"
  },
) => ({
  id: o.eventId,
  type,
  created: 1_800_000_000,
  data: {
    object: {
      id: o.sessionId,
      payment_status: o.paymentStatus ?? "paid",
      payment_intent: o.paymentIntent ?? null,
      amount_total: 4500,
      currency: "cad",
    },
  },
})

// Complète un pending par le chemin réel et rend la transaction créditée.
const paidTransaction = async (userId: string) => {
  const tx = await seedPending(userId)
  const result = await fulfil(
    checkoutEvent("checkout.session.completed", {
      eventId: `evt_${tx.id}`,
      sessionId: tx.sessionId,
      paymentIntent: tx.paymentIntent,
    }),
  )
  expect(result.deferred).toBeDefined()
  return tx
}

const disputeEvent = (
  type: "charge.dispute.created" | "charge.dispute.closed",
  o: {
    eventId: string
    disputeId: string
    paymentIntent: string
    status: string
  },
) => ({
  id: o.eventId,
  type,
  created: 1_800_000_500,
  data: {
    object: {
      id: o.disputeId,
      amount: 4500,
      currency: "cad",
      reason: "fraudulent",
      status: o.status,
      payment_intent: o.paymentIntent,
    },
  },
})

const refundEvent = (o: {
  eventId: string
  paymentIntent: string
  amountRefunded: number
}) => ({
  id: o.eventId,
  type: "charge.refunded",
  created: 1_800_000_900,
  data: {
    object: {
      id: `ch_${o.eventId}`,
      currency: "cad",
      amount: 4500,
      amount_refunded: o.amountRefunded,
      refunded: o.amountRefunded === 4500,
      payment_intent: o.paymentIntent,
    },
  },
})

beforeAll(async () => {
  await db.insert(products).values({
    id: PRODUCT_ID,
    code: "exam_access",
    name: `Exam ${suffix}`,
    description: "desc",
    priceCad: 5000,
    durationDays: DURATION_DAYS,
    accessType: "exam",
    isCombo: false,
    stripeProductId: `prod_f_${suffix}`,
    stripePriceId: `price_f_${suffix}`,
    stripePriceLookupKey: `price_f_${suffix}`,
  })
})

afterAll(async () => {
  await db.delete(userAccess).where(inArray(userAccess.userId, seededUsers))
  await db.delete(transactions).where(inArray(transactions.userId, seededUsers))
  await db.delete(products).where(eq(products.id, PRODUCT_ID))
  await db.delete(user).where(inArray(user.id, seededUsers))
})

beforeEach(() => {
  mailbox.reset()
  stripeBox.reset()
})

describe("fulfillment — octroi", () => {
  it("checkout.session.completed sur un pending → completed, accès octroyé, courriel différé puis marqué", async () => {
    const userId = await newUser()
    const tx = await seedPending(userId)

    const result = await fulfil(
      checkoutEvent("checkout.session.completed", {
        eventId: `evt_${tx.id}`,
        sessionId: tx.sessionId,
        paymentIntent: tx.paymentIntent,
      }),
    )

    const row = await txRow(tx.id)
    expect(row.status).toBe("completed")
    expect(row.eventId).toBe(`evt_${tx.id}`)
    expect(row.paymentIntent).toBe(tx.paymentIntent)
    // Montant réellement facturé par Stripe, pas le prix catalogue du pending.
    expect(row.amountPaid).toBe(4500)
    const access = await examAccess(userId)
    expect(access?.expiresAt.getTime()).toBe(
      row.completedAt!.getTime() + DURATION_DAYS * DAY,
    )

    // Rien n'est parti pendant le fulfillment ; le différé envoie et marque.
    expect(mailbox.sent).toEqual([])
    expect(row.confirmationMessageId).toBeNull()
    await result.deferred!()
    expect(fakeMailer.sendPurchaseConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining("@test.invalid"),
        productName: `Exam ${suffix}`,
        amountPaid: 4500,
        currency: "CAD",
        grantedAccess: [{ accessType: "exam", expiresAt: access!.expiresAt }],
      }),
    )
    const marked = await txRow(tx.id)
    expect(marked.confirmationMessageId).toBe("ses-msg-1")
    expect(marked.confirmationSentAt).not.toBeNull()
  })

  it("completed puis async_payment_succeeded (rejeu et second événement) → une seule créditation, rien de différé", async () => {
    const userId = await newUser()
    const tx = await paidTransaction(userId)
    const before = await examAccess(userId)

    const replayed = await fulfil(
      checkoutEvent("checkout.session.async_payment_succeeded", {
        eventId: `evt_${tx.id}`,
        sessionId: tx.sessionId,
        paymentIntent: tx.paymentIntent,
      }),
    )
    const second = await fulfil(
      checkoutEvent("checkout.session.async_payment_succeeded", {
        eventId: `evt_${tx.id}_async`,
        sessionId: tx.sessionId,
        paymentIntent: tx.paymentIntent,
      }),
    )

    expect(replayed.deferred).toBeUndefined()
    expect(second.deferred).toBeUndefined()
    expect(await examAccess(userId)).toEqual(before)
    expect((await txRow(tx.id)).eventId).toBe(`evt_${tx.id}`)
  })

  it("completed en unpaid (paiement différé) → rien n'est écrit", async () => {
    const userId = await newUser()
    const tx = await seedPending(userId)

    const result = await fulfil(
      checkoutEvent("checkout.session.completed", {
        eventId: `evt_${tx.id}`,
        sessionId: tx.sessionId,
        paymentStatus: "unpaid",
      }),
    )

    expect(result.deferred).toBeUndefined()
    const row = await txRow(tx.id)
    expect(row.status).toBe("pending")
    expect(row.eventId).toBeNull()
    expect(await examAccess(userId)).toBeNull()
  })

  it("checkout.session.expired sur un pending → failed, rappel de panier différé", async () => {
    const userId = await newUser()
    const tx = await seedPending(userId)

    const result = await fulfil(
      checkoutEvent("checkout.session.expired", {
        eventId: `evt_${tx.id}`,
        sessionId: tx.sessionId,
      }),
    )

    expect((await txRow(tx.id)).status).toBe("failed")
    expect(await examAccess(userId)).toBeNull()
    expect(mailbox.sent).toEqual([])
    await result.deferred!()
    expect(mailbox.sent.map((m) => m.verb)).toEqual(["sendAbandonedCartEmail"])
  })
})

describe("fulfillment — litiges et retours de fonds", () => {
  // Carte de test 0259 : Stripe livre le litige AVANT `checkout.session.completed`.
  // La transaction est encore pending, sans payment_intent ; seule sa session
  // Checkout, connue de Stripe, permet de la retrouver.
  it("charge.dispute.created avant le fulfillment → rattaché par la session Checkout", async () => {
    const userId = await newUser()
    const tx = await seedPending(userId)
    stripeBox.seedCheckoutSession({
      id: tx.sessionId,
      payment_intent: tx.paymentIntent,
    })

    await fulfil(
      disputeEvent("charge.dispute.created", {
        eventId: `evt_${tx.id}`,
        disputeId: `dp_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        status: "needs_response",
      }),
    )

    expect(stripeBox.calls).toEqual([
      { verb: "findCheckoutSessionByPaymentIntent", input: tx.paymentIntent },
    ])
    const row = await txRow(tx.id)
    expect(row.status).toBe("pending")
    expect(row.disputeId).toBe(`dp_${tx.id}`)
    expect(row.disputeStatus).toBe("needs_response")
    expect(row.paymentIntent).toBe(tx.paymentIntent)
    const alerts = vi
      .mocked(captureServerError)
      .mock.calls.map(([, error]) => (error as Error).message)
    expect(alerts).toEqual(["litige ouvert sur un paiement Stripe"])
  })

  it("charge.refunded complet → refunded à la date de l'événement, accès retiré", async () => {
    const userId = await newUser()
    const tx = await paidTransaction(userId)

    await fulfil(
      refundEvent({
        eventId: `evt_r_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        amountRefunded: 4500,
      }),
    )

    const row = await txRow(tx.id)
    expect(row.status).toBe("refunded")
    expect(row.refundedAt).toEqual(new Date(1_800_000_900 * 1000))
    expect(await examAccess(userId)).toBeNull()
  })

  it("charge.refunded partiel → alerte seule, transaction et accès intacts", async () => {
    const userId = await newUser()
    const tx = await paidTransaction(userId)
    const before = await examAccess(userId)
    vi.mocked(captureServerError).mockClear()

    await fulfil(
      refundEvent({
        eventId: `evt_p_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        amountRefunded: 1000,
      }),
    )

    expect((await txRow(tx.id)).status).toBe("completed")
    expect(await examAccess(userId)).toEqual(before)
    expect(captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.objectContaining({
        message: "remboursement partiel, accès conservé",
      }),
      expect.objectContaining({ detail: expect.stringContaining("1000/4500") }),
    )
  })

  it("charge.dispute.closed lost → refunded, accès retiré ; rejeu → skipped, rien ne change", async () => {
    const userId = await newUser()
    const tx = await paidTransaction(userId)
    const lost = disputeEvent("charge.dispute.closed", {
      eventId: `evt_l_${tx.id}`,
      disputeId: `dp_${tx.id}`,
      paymentIntent: tx.paymentIntent,
      status: "lost",
    })

    await fulfil(lost)

    const row = await txRow(tx.id)
    expect(row.status).toBe("refunded")
    expect(row.refundedAt).toEqual(new Date(1_800_000_500 * 1000))
    expect(row.disputeStatus).toBe("lost")
    expect(await examAccess(userId)).toBeNull()

    vi.mocked(captureServerError).mockClear()
    await fulfil(lost)

    expect(await txRow(tx.id)).toEqual(row)
    const alerts = vi
      .mocked(captureServerError)
      .mock.calls.map(([, error, context]) => [
        (error as Error).message,
        context?.detail,
      ])
    expect(alerts[1]).toEqual([
      "litige perdu · retrait d'accès",
      expect.stringContaining("déjà refunded"),
    ])
  })
})
