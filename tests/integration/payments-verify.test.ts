import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import {
  createStripeCheckout,
  verifyStripeCheckout,
} from "@/features/payments/actions"
import { getCheckoutPurchase } from "@/features/payments/dal"
import { completeStripeTransaction } from "@/features/payments/stripe"
import { createId } from "@/lib/ids"
import { stripeBox } from "../helpers/fake-stripe"
import { seedProduct } from "../helpers/seed-payments"

const { mocks } = vi.hoisted(() => ({
  mocks: { sessionUserId: { current: "" } },
}))

vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({
    user: { id: mocks.sessionUserId.current, email: "verify@test.invalid" },
  })),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/stripe", () =>
  import("../helpers/fake-stripe").then((m) => m.fakeStripe),
)
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const BUYER = createId()
const OTHER = createId()
const EXAM_KEY = "verify_exam"
const COMBO_KEY = "verify_combo"

/** Passe par le vrai checkout : la transaction `pending` et la session Stripe naissent ensemble. */
const checkout = async (productCode: "exam_access" | "premium_access") => {
  const res = await createStripeCheckout({
    productCode,
    successPath: "/tableau-de-bord/paiement/succes",
    cancelPath: "/tarifs",
  })
  if (!("checkoutUrl" in res)) throw new Error(res.error)
  const [last] = [...stripeBox.checkoutSessions.values()].slice(-1)
  last.payment_status = "paid"
  last.amount_total = 5000
  last.currency = "cad"
  return last.id
}

const fulfil = (stripeSessionId: string) =>
  completeStripeTransaction({
    stripeSessionId,
    stripePaymentIntentId: `pi_${createId()}`,
    stripeEventId: `evt_${createId()}`,
  })

beforeAll(async () => {
  await db.insert(user).values([
    { id: BUYER, name: "Buyer", email: "buyer@test.invalid" },
    { id: OTHER, name: "Other", email: "other@test.invalid" },
  ])
  await seedProduct("exam_access", {
    name: "Examens",
    stripePriceLookupKey: EXAM_KEY,
  })
  await seedProduct("premium_access", {
    name: "Pack Premium",
    stripePriceLookupKey: COMBO_KEY,
  })
})

beforeEach(async () => {
  stripeBox.reset()
  for (const key of [EXAM_KEY, COMBO_KEY]) {
    stripeBox.prices.push({
      id: `price_${key}`,
      unit_amount: 5000,
      currency: "cad",
      lookup_key: key,
    })
  }
  mocks.sessionUserId.current = BUYER
  await db.delete(userAccess).where(eq(userAccess.userId, BUYER))
  await db.delete(transactions).where(eq(transactions.userId, BUYER))
})

describe("verifyStripeCheckout — achat lu en base", () => {
  it("webhook pas encore passé : produit connu, accès non activé", async () => {
    const sessionId = await checkout("exam_access")

    const res = await verifyStripeCheckout(sessionId)

    expect(res).toMatchObject({
      success: true,
      status: "paid",
      purchase: {
        productName: "Examens",
        status: "pending",
        access: [],
      },
    })
  })

  it("après le fulfillment : accès activé, expiration lue dans user_access", async () => {
    const sessionId = await checkout("exam_access")
    await fulfil(sessionId)
    const [row] = await db
      .select({ expiresAt: userAccess.expiresAt })
      .from(userAccess)
      .where(eq(userAccess.userId, BUYER))

    const res = await verifyStripeCheckout(sessionId)

    expect(res).toMatchObject({
      success: true,
      purchase: {
        status: "completed",
        access: [{ type: "exam", expiresAt: row.expiresAt.getTime() }],
      },
    })
  })

  it("produit combo : les deux accès, examens d'abord", async () => {
    const sessionId = await checkout("premium_access")
    await fulfil(sessionId)

    const res = await verifyStripeCheckout(sessionId)

    if (!res.success) throw new Error(res.error)
    expect(res.purchase?.productName).toBe("Pack Premium")
    expect(res.purchase?.access.map((a) => a.type)).toEqual([
      "exam",
      "training",
    ])
  })

  it("achat remboursé depuis : statut remboursé, aucun accès annoncé", async () => {
    const sessionId = await checkout("exam_access")
    await fulfil(sessionId)
    await db
      .update(transactions)
      .set({ status: "refunded", refundedAt: new Date() })
      .where(eq(transactions.stripeSessionId, sessionId))

    const res = await verifyStripeCheckout(sessionId)

    expect(res).toMatchObject({
      success: true,
      purchase: { status: "refunded", access: [] },
    })
  })

  it("session d'un autre compte : refusée, rien de l'achat ne fuit", async () => {
    const sessionId = await checkout("exam_access")
    mocks.sessionUserId.current = OTHER

    const res = await verifyStripeCheckout(sessionId)

    expect(res).toEqual({
      success: false,
      error: "Session non trouvée ou invalide",
    })
  })

  it("la lecture de l'achat ne rend jamais celui d'un autre compte", async () => {
    const sessionId = await checkout("exam_access")
    await fulfil(sessionId)
    mocks.sessionUserId.current = OTHER

    expect(await getCheckoutPurchase(sessionId)).toBeNull()
  })
})
