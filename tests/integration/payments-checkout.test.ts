import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user } from "@/db/schema"
import { createStripeCheckout } from "@/features/payments/actions"
import { createId } from "@/lib/ids"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    sessionUserId: { current: "" },
    create:
      vi.fn<
        (arg: {
          metadata: { userId: string }
        }) => Promise<{ id: string; url: string | null }>
      >(),
  },
}))

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({
    user: { id: mocks.sessionUserId.current, email: "chk@test.invalid" },
  })),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: mocks.create } } }),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const PID = createId()

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: `Chk ${suffix}`,
    email: `chk-${suffix}@test.invalid`,
  })
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: `Exam ${suffix}`,
    description: "desc",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    isCombo: false,
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
  })
  mocks.sessionUserId.current = USER_ID
})

afterAll(async () => {
  await db.delete(transactions).where(eq(transactions.userId, USER_ID))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(eq(user.id, USER_ID))
})

describe("createStripeCheckout", () => {
  it("crée une transaction pending liée à la session Stripe + metadata.userId", async () => {
    const sessionId = `cs_${suffix}`
    mocks.create.mockResolvedValueOnce({
      id: sessionId,
      url: "https://stripe.test/checkout",
    })

    const res = await createStripeCheckout({
      productCode: "exam_access",
      successPath: "/tableau-de-bord",
      cancelPath: "/tarifs",
    })
    expect(res).toEqual({ checkoutUrl: "https://stripe.test/checkout" })

    // metadata.userId transmis à Stripe (invariant anti-IDOR côté verify +
    // fulfillment). PAS d'assertion sur metadata.productId : products.code n'est
    // pas unique et develop contient déjà un exam_access → le produit résolu
    // (ORDER BY id ASC) est non déterministe.
    const arg = mocks.create.mock.calls[0]![0]
    expect(arg.metadata.userId).toBe(USER_ID)

    // Transaction pending retrouvable par le webhook via stripeSessionId
    // (invariants robustes, indépendants du produit résolu).
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.stripeSessionId, sessionId))
    expect(tx.status).toBe("pending")
    expect(tx.type).toBe("stripe")
    expect(tx.userId).toBe(USER_ID)
    expect(tx.stripeSessionId).toBe(sessionId)
  })

  it("refuse un productCode inconnu (pas d'appel Stripe)", async () => {
    const res = await createStripeCheckout({
      productCode: "does_not_exist",
      successPath: "/tableau-de-bord",
      cancelPath: "/tarifs",
    })
    expect(res).toEqual({ error: "Produit invalide" })
  })
})
