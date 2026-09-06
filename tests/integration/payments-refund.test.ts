import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { updateManualTransaction } from "@/features/payments/actions"
import { recomputeAccess } from "@/features/payments/lib"
import { refundStripeTransaction } from "@/features/payments/stripe"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({}) }))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const productId = createId()
const adminId = createId()
const users = {
  full: createId(),
  covered: createId(),
  pending: createId(),
  manual: createId(),
}
const tx = {
  full: createId(),
  coveredShort: createId(),
  coveredLong: createId(),
  pending: createId(),
  manual: createId(),
}
const pi = (k: keyof typeof tx) => `pi_refund_${k}_${suffix}`

const seed = (o: {
  id: string
  userId: string
  status: "pending" | "completed"
  days: number
  paymentIntent: string | null
  type?: "stripe" | "manual"
}) =>
  db.insert(transactions).values({
    id: o.id,
    userId: o.userId,
    productId,
    type: o.type ?? "stripe",
    status: o.status,
    amountPaid: 5000,
    currency: "CAD",
    stripeSessionId: o.paymentIntent ? `cs_${o.id}` : null,
    stripePaymentIntentId: o.paymentIntent,
    paymentMethod: o.type === "manual" ? "interac" : null,
    accessType: "exam",
    durationDays: o.days,
    accessExpiresAt: new Date(Date.now() + o.days * DAY),
    completedAt: o.status === "completed" ? new Date() : null,
  })

const examAccess = (userId: string) =>
  db
    .select({
      expiresAt: userAccess.expiresAt,
      last: userAccess.lastTransactionId,
    })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, "exam")),
    )
    .limit(1)
    .then((r) => r[0] ?? null)

const txRow = (id: string) =>
  db
    .select({
      status: transactions.status,
      refundedAt: transactions.refundedAt,
    })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)
    .then((r) => r[0])

const rebuild = (userId: string) =>
  db.transaction((t) => recomputeAccess(t, { userId }))

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: adminId,
      name: "Admin",
      email: `refund-admin-${suffix}@test.invalid`,
      role: "admin",
    },
    ...Object.entries(users).map(([k, id]) => ({
      id,
      name: `Refund ${k}`,
      email: `refund-${k}-${suffix}@test.invalid`,
    })),
  ])
  await db.insert(products).values({
    id: productId,
    code: "exam_access",
    name: "Exam",
    description: "d",
    priceCad: 5000,
    durationDays: 30,
    accessType: "exam",
    stripeProductId: `prod_refund_${suffix}`,
    stripePriceId: `price_refund_${suffix}`,
    stripePriceLookupKey: `price_refund_${suffix}`,
  })
  await seed({
    id: tx.full,
    userId: users.full,
    status: "completed",
    days: 30,
    paymentIntent: pi("full"),
  })
  await seed({
    id: tx.coveredShort,
    userId: users.covered,
    status: "completed",
    days: 30,
    paymentIntent: pi("coveredShort"),
  })
  await seed({
    id: tx.coveredLong,
    userId: users.covered,
    status: "completed",
    days: 60,
    paymentIntent: pi("coveredLong"),
  })
  await seed({
    id: tx.pending,
    userId: users.pending,
    status: "pending",
    days: 30,
    paymentIntent: pi("pending"),
  })
  await seed({
    id: tx.manual,
    userId: users.manual,
    status: "completed",
    days: 30,
    paymentIntent: null,
    type: "manual",
  })
  for (const id of Object.values(users)) await rebuild(id)
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, role: "admin" },
    session: { id: createId() },
  } as never)
})

afterAll(async () => {
  for (const id of Object.values(users)) {
    await db.delete(userAccess).where(eq(userAccess.userId, id))
  }
  await db.delete(transactions).where(eq(transactions.productId, productId))
  await db.delete(products).where(eq(products.id, productId))
  for (const id of [adminId, ...Object.values(users)]) {
    await db.delete(user).where(eq(user.id, id))
  }
})

describe("refundStripeTransaction", () => {
  const refundedAt = new Date("2026-09-05T10:00:00Z")

  it("remboursement complet : refunded + refunded_at, accès retiré", async () => {
    expect(await examAccess(users.full)).not.toBeNull()
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("full"),
      refundedAt,
    })
    expect(r).toEqual({
      status: "refunded",
      userId: users.full,
      accessReducedOrRemoved: true,
    })
    expect(await txRow(tx.full)).toEqual({ status: "refunded", refundedAt })
    expect(await examAccess(users.full)).toBeNull()
  })

  it("rejeu : skipped, rien ne bouge", async () => {
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("full"),
      refundedAt: new Date(),
    })
    expect(r).toEqual({ status: "skipped", currentStatus: "refunded" })
    expect(await txRow(tx.full)).toEqual({ status: "refunded", refundedAt })
  })

  it("autre transaction couvrante : accès raccourci, re-pointé", async () => {
    const before = await examAccess(users.covered)
    expect(before?.last).toBe(tx.coveredLong)
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("coveredLong"),
      refundedAt,
    })
    expect(r).toMatchObject({
      status: "refunded",
      accessReducedOrRemoved: true,
    })
    const after = await examAccess(users.covered)
    expect(after?.last).toBe(tx.coveredShort)
    expect(after!.expiresAt.getTime()).toBeLessThan(before!.expiresAt.getTime())
  })

  it("transaction pending : skipped, accès intact", async () => {
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("pending"),
      refundedAt,
    })
    expect(r).toEqual({ status: "skipped", currentStatus: "pending" })
    expect(await txRow(tx.pending)).toEqual({
      status: "pending",
      refundedAt: null,
    })
  })

  it("payment_intent inconnu : not_found", async () => {
    const r = await refundStripeTransaction({
      stripePaymentIntentId: `pi_inconnu_${suffix}`,
      refundedAt,
    })
    expect(r).toEqual({ status: "not_found" })
  })
})

describe("updateManualTransaction — refunded_at", () => {
  const base = {
    transactionId: tx.manual,
    amountPaid: 5000,
    currency: "CAD" as const,
    paymentMethod: "interac",
  }

  it("posée sur completed → refunded, effacée sur refunded → completed", async () => {
    expect(
      await updateManualTransaction({ ...base, status: "refunded" }),
    ).toEqual({ success: true })
    const refunded = await txRow(tx.manual)
    expect(refunded?.status).toBe("refunded")
    expect(refunded?.refundedAt).toBeInstanceOf(Date)
    expect(await examAccess(users.manual)).toBeNull()

    expect(
      await updateManualTransaction({ ...base, status: "completed" }),
    ).toEqual({ success: true })
    expect(await txRow(tx.manual)).toEqual({
      status: "completed",
      refundedAt: null,
    })
    expect(await examAccess(users.manual)).not.toBeNull()
  })
})
