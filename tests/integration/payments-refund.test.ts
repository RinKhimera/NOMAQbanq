import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import { rebuildFromTransactions } from "@/features/payments/access-ledger"
import { updateManualTransaction } from "@/features/payments/actions"
import { refundStripeTransaction } from "@/features/payments/stripe"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { seedProduct } from "../helpers/seed-payments"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/stripe", () =>
  import("../helpers/fake-stripe").then((m) => m.fakeStripe),
)

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const at = (days: number) => new Date(NOW + days * DAY)
const adminId = createId()
let productId = ""

const newUser = async () => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: `Refund ${id}`, email: `refund-${id}@test.invalid` })
  return id
}

/**
 * Une transaction et l'accès que le registre en déduit. Renvoie son id et son
 * payment_intent (nul pour un paiement manuel).
 */
const seed = async (o: {
  userId: string
  status: "pending" | "completed"
  days: number
  type?: "stripe" | "manual"
}) => {
  const id = createId()
  const paymentIntent = o.type === "manual" ? null : `pi_${id}`
  await db.insert(transactions).values({
    id,
    userId: o.userId,
    productId,
    type: o.type ?? "stripe",
    status: o.status,
    amountPaid: 5000,
    currency: "CAD",
    stripeSessionId: paymentIntent ? `cs_${id}` : null,
    stripePaymentIntentId: paymentIntent,
    paymentMethod: o.type === "manual" ? "interac" : null,
    accessType: "exam",
    durationDays: o.days,
    accessExpiresAt: at(o.days),
    completedAt: o.status === "completed" ? new Date(NOW) : null,
  })
  await db.transaction((t) => rebuildFromTransactions(t, { userId: o.userId }))
  return { id, paymentIntent: paymentIntent! }
}

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

beforeAll(async () => {
  await db.insert(user).values({
    id: adminId,
    name: "Admin",
    email: "refund-admin@test.invalid",
    role: "admin",
  })
  productId = await seedProduct("exam_access")
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, role: "admin" },
    session: { id: createId() },
  } as never)
})

describe("refundStripeTransaction", () => {
  const refundedAt = new Date("2026-09-05T10:00:00Z")

  it("remboursement complet : refunded + refunded_at, accès retiré", async () => {
    const userId = await newUser()
    const full = await seed({ userId, status: "completed", days: 30 })
    expect(await examAccess(userId)).toEqual({
      expiresAt: at(30),
      last: full.id,
    })

    const r = await refundStripeTransaction({
      stripePaymentIntentId: full.paymentIntent,
      refundedAt,
    })
    expect(r).toEqual({
      status: "refunded",
      userId,
      accessReducedOrRemoved: true,
    })
    expect(await txRow(full.id)).toEqual({ status: "refunded", refundedAt })
    expect(await examAccess(userId)).toBeNull()
  })

  it("rejeu : skipped, rien ne bouge", async () => {
    const userId = await newUser()
    const full = await seed({ userId, status: "completed", days: 30 })
    await refundStripeTransaction({
      stripePaymentIntentId: full.paymentIntent,
      refundedAt,
    })

    const r = await refundStripeTransaction({
      stripePaymentIntentId: full.paymentIntent,
      refundedAt: new Date(),
    })
    expect(r).toEqual({ status: "skipped", currentStatus: "refunded" })
    expect(await txRow(full.id)).toEqual({ status: "refunded", refundedAt })
  })

  it("autre transaction couvrante : accès raccourci, re-pointé", async () => {
    const userId = await newUser()
    const short = await seed({ userId, status: "completed", days: 30 })
    const long = await seed({ userId, status: "completed", days: 60 })
    expect(await examAccess(userId)).toEqual({
      expiresAt: at(60),
      last: long.id,
    })

    const r = await refundStripeTransaction({
      stripePaymentIntentId: long.paymentIntent,
      refundedAt,
    })
    expect(r).toMatchObject({
      status: "refunded",
      accessReducedOrRemoved: true,
    })
    expect(await examAccess(userId)).toEqual({
      expiresAt: at(30),
      last: short.id,
    })
  })

  it("transaction pending : skipped, accès intact", async () => {
    const userId = await newUser()
    const pending = await seed({ userId, status: "pending", days: 30 })
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pending.paymentIntent,
      refundedAt,
    })
    expect(r).toEqual({ status: "skipped", currentStatus: "pending" })
    expect(await txRow(pending.id)).toEqual({
      status: "pending",
      refundedAt: null,
    })
  })

  it("payment_intent inconnu : not_found", async () => {
    const r = await refundStripeTransaction({
      stripePaymentIntentId: "pi_inconnu",
      refundedAt,
    })
    expect(r).toEqual({ status: "not_found" })
  })
})

describe("updateManualTransaction — refunded_at", () => {
  it("posée sur completed → refunded, effacée sur refunded → completed", async () => {
    const userId = await newUser()
    const manual = await seed({
      userId,
      status: "completed",
      days: 30,
      type: "manual",
    })
    const base = {
      transactionId: manual.id,
      amountPaid: 5000,
      currency: "CAD" as const,
      paymentMethod: "interac",
    }

    expect(
      await updateManualTransaction({ ...base, status: "refunded" }),
    ).toEqual({ success: true })
    const refunded = await txRow(manual.id)
    expect(refunded?.status).toBe("refunded")
    expect(refunded?.refundedAt).toBeInstanceOf(Date)
    expect(await examAccess(userId)).toBeNull()

    expect(
      await updateManualTransaction({ ...base, status: "completed" }),
    ).toEqual({ success: true })
    expect(await txRow(manual.id)).toEqual({
      status: "completed",
      refundedAt: null,
    })
    expect(await examAccess(userId)).toEqual({
      expiresAt: at(30),
      last: manual.id,
    })
  })
})
