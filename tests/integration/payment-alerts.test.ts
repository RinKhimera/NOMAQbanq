import { eq } from "drizzle-orm"
import type Stripe from "stripe"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import { fulfilStripeEvent } from "@/features/payments/fulfillment"
import { createId } from "@/lib/ids"
import { fakeMailer, mailbox } from "../helpers/fake-mailer"
import { stripeBox } from "../helpers/fake-stripe"
import { seedAccess, seedProduct } from "../helpers/seed-payments"

// Alertes de paiement (`CONTEXT.md`) de bout en bout : l'événement Stripe
// passe par le vrai fulfillment, le différé envoie aux administrateurs.
vi.mock("@/lib/observability", () => ({ captureServerError: vi.fn() }))
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
let PRODUCT_ID = ""
const ADMIN = createId()
const ADMIN_OPTED_OUT = createId()
const ADMIN_BANNED = createId()

const fulfil = (event: unknown) => fulfilStripeEvent(event as Stripe.Event)

/** Fulfillment puis envoi différé, comme la route après l'acquittement. */
const fulfilAndSend = async (event: unknown) => {
  const result = await fulfil(event)
  await result.deferred?.()
}

const alertsSent = () =>
  vi.mocked(fakeMailer.sendPaymentAlertEmail).mock.calls.map(([input]) => input)

const newCandidate = async () => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: `Candidat ${id}`, email: `c-${id}@test.invalid` })
  return id
}

// Transaction complétée par le vrai chemin (pending puis checkout payé).
const paidTransaction = async (userId: string) => {
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
  await fulfil({
    id: `evt_paid_${id}`,
    type: "checkout.session.completed",
    created: 1_800_000_000,
    data: {
      object: {
        id: `cs_${id}`,
        payment_status: "paid",
        payment_intent: `pi_${id}`,
        amount_total: 4500,
        currency: "cad",
      },
    },
  })
  return { id, paymentIntent: `pi_${id}` }
}

const disputeEvent = (
  type:
    | "charge.dispute.created"
    | "charge.dispute.closed"
    | "charge.dispute.updated",
  o: { eventId: string; paymentIntent: string; status: string },
) => ({
  id: o.eventId,
  type,
  created: 1_800_000_500,
  data: {
    object: {
      id: `dp_${o.eventId}`,
      amount: 4500,
      currency: "cad",
      reason: "product_not_received",
      status: o.status,
      payment_intent: o.paymentIntent,
      evidence_details: { due_by: 1_800_600_000 },
    },
  },
})

// Transaction Stripe complétée posée sans le chemin d'octroi, avec son accès :
// pour les cas où l'échéance ou la devise compte.
const completedStripe = async (
  userId: string,
  o: { amountPaid: number; currency: "CAD" | "XAF"; expiresAt: Date },
) => {
  const id = createId()
  await db.insert(transactions).values({
    id,
    userId,
    productId: PRODUCT_ID,
    type: "stripe",
    status: "completed",
    amountPaid: o.amountPaid,
    currency: o.currency,
    stripeSessionId: `cs_${id}`,
    stripePaymentIntentId: `pi_${id}`,
    accessType: "exam",
    durationDays: DURATION_DAYS,
    accessExpiresAt: o.expiresAt,
    completedAt: new Date(o.expiresAt.getTime() - DURATION_DAYS * DAY),
  })
  await db
    .insert(userAccess)
    .values({
      userId,
      accessType: "exam",
      expiresAt: o.expiresAt,
      lastTransactionId: id,
    })
    .onConflictDoNothing()
  return { id, paymentIntent: `pi_${id}` }
}

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
  PRODUCT_ID = await seedProduct("exam_access", {
    name: "Accès Examens",
    durationDays: DURATION_DAYS,
  })
  await db.insert(user).values([
    {
      id: ADMIN,
      name: "Sandrine Admin",
      email: "sandrine@test.invalid",
      role: "admin",
    },
    {
      id: ADMIN_OPTED_OUT,
      name: "Admin Silencieux",
      email: "silence@test.invalid",
      role: "admin",
      notifyPaymentAlerts: false,
    },
    {
      id: ADMIN_BANNED,
      name: "Admin Suspendu",
      email: "suspendu@test.invalid",
      role: "admin",
      banned: true,
    },
  ])
})

beforeEach(() => {
  mailbox.reset()
  stripeBox.reset()
})

describe("alertes de paiement", () => {
  it("litige ouvert : un courriel au seul admin éligible qui accepte les alertes, aucun au rejeu", async () => {
    const candidate = await newCandidate()
    const tx = await paidTransaction(candidate)
    const opened = disputeEvent("charge.dispute.created", {
      eventId: `evt_open_${tx.id}`,
      paymentIntent: tx.paymentIntent,
      status: "needs_response",
    })

    await fulfilAndSend(opened)
    await fulfilAndSend(opened)

    expect(alertsSent()).toEqual([
      {
        to: "sandrine@test.invalid",
        name: "Sandrine Admin",
        alert: {
          kind: "dispute_opened",
          status: "needs_response",
          money: { amount: 4500, currency: "cad" },
          dueBy: new Date(1_800_600_000 * 1000),
          reason: "product_not_received",
          candidate: {
            name: `Candidat ${candidate}`,
            email: `c-${candidate}@test.invalid`,
            productName: "Accès Examens",
            paidAt: expect.any(Date),
            transactionUrl: expect.stringMatching(
              new RegExp(
                `/admin/transactions\\?client=${candidate}&tx=${tx.id}$`,
              ),
            ),
          },
          stripeUrl: expect.stringContaining(tx.paymentIntent),
        },
      },
    ])
  })

  it("litige ouvert sur un paiement inconnu : l'alerte part sans candidat", async () => {
    await fulfilAndSend(
      disputeEvent("charge.dispute.created", {
        eventId: `evt_orphan_${createId()}`,
        paymentIntent: "pi_inconnu",
        status: "needs_response",
      }),
    )

    expect(alertsSent()).toHaveLength(1)
    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "dispute_opened",
      candidate: null,
    })
  })

  it("alerte de fraude précoce : le montant vient de la transaction", async () => {
    const tx = await paidTransaction(await newCandidate())

    await fulfilAndSend({
      id: `evt_efw_${tx.id}`,
      type: "radar.early_fraud_warning.created",
      created: 1_800_000_700,
      data: {
        object: {
          id: `issfr_${tx.id}`,
          charge: `ch_${tx.id}`,
          fraud_type: "made_with_stolen_card",
          payment_intent: tx.paymentIntent,
        },
      },
    })

    expect(alertsSent()).toHaveLength(1)
    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "early_fraud_warning",
      money: { amount: 4500, currency: "cad" },
    })
  })

  it("litige perdu : l'accès est dit retiré quand plus rien ne le couvre", async () => {
    const tx = await paidTransaction(await newCandidate())

    await fulfilAndSend(
      disputeEvent("charge.dispute.closed", {
        eventId: `evt_lost_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        status: "lost",
      }),
    )

    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "dispute_closed",
      status: "lost",
      access: "removed",
    })
  })

  it("remboursement complet : l'accès est dit maintenu quand un autre achat le couvre", async () => {
    const candidate = await newCandidate()
    await seedAccess(candidate, "exam", new Date(Date.now() + 400 * DAY), {
      productId: PRODUCT_ID,
    })
    const tx = await paidTransaction(candidate)

    await fulfilAndSend(
      refundEvent({
        eventId: `evt_refund_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        amountRefunded: 4500,
      }),
    )

    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "refunded",
      access: "kept",
    })
  })

  it("remboursement d'une transaction jamais complétée : aucun retrait n'est annoncé", async () => {
    const candidate = await newCandidate()
    const id = createId()
    await db.insert(transactions).values({
      id,
      userId: candidate,
      productId: PRODUCT_ID,
      type: "stripe",
      status: "failed",
      amountPaid: 4500,
      currency: "CAD",
      stripeSessionId: `cs_${id}`,
      stripePaymentIntentId: `pi_${id}`,
      accessType: "exam",
      durationDays: DURATION_DAYS,
      accessExpiresAt: new Date(Date.now() + DURATION_DAYS * DAY),
    })

    await fulfilAndSend(
      refundEvent({
        eventId: `evt_failed_${id}`,
        paymentIntent: `pi_${id}`,
        amountRefunded: 4500,
      }),
    )

    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "refunded",
      access: null,
    })
  })

  it("litige gagné : l'accès relu en base est annoncé maintenu", async () => {
    const tx = await paidTransaction(await newCandidate())

    await fulfilAndSend(
      disputeEvent("charge.dispute.closed", {
        eventId: `evt_won_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        status: "won",
      }),
    )

    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "dispute_closed",
      status: "won",
      access: "kept",
      transactionRefunded: false,
    })
  })

  it("ni le remboursement partiel ni la mise à jour d'un litige n'envoient de courriel", async () => {
    const tx = await paidTransaction(await newCandidate())

    await fulfilAndSend(
      refundEvent({
        eventId: `evt_partial_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        amountRefunded: 1000,
      }),
    )
    await fulfilAndSend(
      disputeEvent("charge.dispute.updated", {
        eventId: `evt_updated_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        status: "under_review",
      }),
    )

    expect(alertsSent()).toEqual([])
  })
  it("remboursement d'un accès déjà expiré : ni retrait ni maintien annoncé", async () => {
    const candidate = await newCandidate()
    const tx = await completedStripe(candidate, {
      amountPaid: 4500,
      currency: "CAD",
      expiresAt: new Date(Date.now() - 10 * DAY),
    })

    await fulfilAndSend(
      refundEvent({
        eventId: `evt_expired_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        amountRefunded: 4500,
      }),
    )

    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "refunded",
      access: "expired",
    })
  })

  it("alerte de fraude sur un paiement en XAF : montant en francs entiers", async () => {
    const tx = await completedStripe(await newCandidate(), {
      amountPaid: 8_500_000,
      currency: "XAF",
      expiresAt: new Date(Date.now() + 30 * DAY),
    })

    await fulfilAndSend({
      id: `evt_efw_xaf_${tx.id}`,
      type: "radar.early_fraud_warning.created",
      created: 1_800_000_700,
      data: {
        object: {
          id: `issfr_${tx.id}`,
          charge: `ch_${tx.id}`,
          fraud_type: "made_with_stolen_card",
          payment_intent: tx.paymentIntent,
        },
      },
    })

    expect(alertsSent()[0]?.alert).toMatchObject({
      money: { amount: 85000, currency: "xaf" },
    })
  })

  it("litige clos sans perte après un remboursement : rien n'est dit acquis", async () => {
    const tx = await paidTransaction(await newCandidate())
    await fulfil(
      refundEvent({
        eventId: `evt_pre_refund_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        amountRefunded: 4500,
      }),
    )
    mailbox.reset()

    await fulfilAndSend(
      disputeEvent("charge.dispute.closed", {
        eventId: `evt_warning_closed_${tx.id}`,
        paymentIntent: tx.paymentIntent,
        status: "warning_closed",
      }),
    )

    expect(alertsSent()[0]?.alert).toMatchObject({
      kind: "dispute_closed",
      status: "warning_closed",
      transactionRefunded: true,
      access: "removed",
    })
  })

  it("rejeu : un admin qui avait refusé les alertes ne les reçoit pas après les avoir réactivées", async () => {
    const tx = await paidTransaction(await newCandidate())
    const opened = disputeEvent("charge.dispute.created", {
      eventId: `evt_replay_${tx.id}`,
      paymentIntent: tx.paymentIntent,
      status: "needs_response",
    })
    await fulfilAndSend(opened)
    try {
      await db
        .update(user)
        .set({ notifyPaymentAlerts: true })
        .where(eq(user.id, ADMIN_OPTED_OUT))
      mailbox.reset()

      await fulfilAndSend(opened)

      expect(alertsSent()).toEqual([])
    } finally {
      await db
        .update(user)
        .set({ notifyPaymentAlerts: false })
        .where(eq(user.id, ADMIN_OPTED_OUT))
    }
  })
})
