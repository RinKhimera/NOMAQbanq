import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user } from "@/db/schema"
import { createStripeCheckout } from "@/features/payments/actions"
import { createId } from "@/lib/ids"
import { fakeStripe, stripeBox } from "../helpers/fake-stripe"
import { seedProduct } from "../helpers/seed-payments"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    sessionUserId: { current: "" },
  },
}))

vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({
    user: { id: mocks.sessionUserId.current, email: "chk@test.invalid" },
  })),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/stripe", () =>
  import("../helpers/fake-stripe").then((m) => m.fakeStripe),
)
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const LOOKUP_KEY = "price_exam"
let PID = ""

/** Un acheteur neuf par test : ses transactions se comptent à partir de zéro. */
const signIn = async () => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: `Chk ${id}`, email: `chk-${id}@test.invalid` })
  mocks.sessionUserId.current = id
  return id
}

const transactionsOf = (userId: string) =>
  db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.userId, userId))

beforeEach(() => {
  stripeBox.reset()
  stripeBox.prices.push({
    id: "price_resolved",
    unit_amount: 5000,
    currency: "cad",
    lookup_key: LOOKUP_KEY,
  })
})

beforeAll(async () => {
  PID = await seedProduct("exam_access", {
    durationDays: 90,
    stripePriceLookupKey: LOOKUP_KEY,
  })
})

describe("createStripeCheckout", () => {
  it("crée une transaction pending liée à la session Stripe + metadata.userId", async () => {
    const userId = await signIn()
    const res = await createStripeCheckout({
      productCode: "exam_access",
      successPath: "/tableau-de-bord",
      cancelPath: "/tarifs",
    })
    expect(res).toEqual({ checkoutUrl: "https://checkout.stripe.test/1" })

    // metadata.userId transmis à Stripe (invariant anti-IDOR côté verify +
    // fulfillment) ; le produit est le seul `exam_access` de la base.
    const [sessionId, created] = [...stripeBox.checkoutSessions][0]!
    expect(created.metadata?.userId).toBe(userId)
    expect(created.metadata?.productId).toBe(PID)

    // Transaction pending retrouvable par le webhook via stripeSessionId.
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.stripeSessionId, sessionId))
    expect(tx.status).toBe("pending")
    expect(tx.type).toBe("stripe")
    expect(tx.userId).toBe(userId)
    expect(tx.stripeSessionId).toBe(sessionId)
  })

  // La devise d'un prix Stripe est immuable : un écart ne peut pas être un état
  // transitoire légitime. C'est le seul cas de refus restant au checkout.
  it("devise Stripe ≠ cad → aucune transaction pending créée", async () => {
    const userId = await signIn()
    stripeBox.prices[0]!.currency = "usd"

    const res = await createStripeCheckout({
      productCode: "exam_access",
      successPath: "/tableau-de-bord",
      cancelPath: "/tarifs",
    })

    expect(res).toEqual({
      error: "Ce produit est mal configuré. Contactez le support.",
    })
    expect(fakeStripe.createCheckoutSession).not.toHaveBeenCalled()
    expect(await transactionsOf(userId)).toEqual([])
  })

  it("refuse un productCode inconnu (pas d'appel Stripe)", async () => {
    await signIn()
    const res = await createStripeCheckout({
      productCode: "does_not_exist",
      successPath: "/tableau-de-bord",
      cancelPath: "/tarifs",
    })
    expect(res).toEqual({ error: "Produit invalide" })
    expect(fakeStripe.createCheckoutSession).not.toHaveBeenCalled()
  })

  it("price_id absent du mode de la clé → message de configuration, aucun pending", async () => {
    const userId = await signIn()
    // Ce que Stripe renvoie quand le price_id appartient à l'autre mode : les
    // préfixes étant identiques en test et en live, c'est le seul signal.
    stripeBox.failNext(
      "createCheckoutSession",
      Object.assign(new Error("No such price"), { code: "resource_missing" }),
    )

    const res = await createStripeCheckout({
      productCode: "exam_access",
      successPath: "/tableau-de-bord",
      cancelPath: "/tarifs",
    })
    expect(res).toEqual({
      error: "Ce produit est mal configuré. Contactez le support.",
    })
    expect(await transactionsOf(userId)).toEqual([])
  })
})
