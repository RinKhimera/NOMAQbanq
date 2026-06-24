import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

import {
  completeStripeTransaction,
  failStripeTransaction,
} from "@/features/payments/stripe"

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)

const PEXAM = createId() // produit exam non-combo
const PCOMBO = createId() // produit combo (exam + training)
const U = Array.from({ length: 5 }, () => createId())
const [U_HAPPY, U_CUMUL, U_COMBO, U_FAIL, U_FAILDONE] = U

const accessOf = (userId: string, accessType: "exam" | "training") =>
  db
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
    })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
    .then((r) => r[0])

const txStatus = (id: string) =>
  db
    .select({
      status: transactions.status,
      completedAt: transactions.completedAt,
      eventId: transactions.stripeEventId,
      pi: transactions.stripePaymentIntentId,
      accessExpiresAt: transactions.accessExpiresAt,
    })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)
    .then((r) => r[0])

const seedPending = (o: {
  id: string
  userId: string
  productId: string
  sessionId: string
  accessType: "exam" | "training"
  durationDays: number
}) =>
  db.insert(transactions).values({
    id: o.id,
    userId: o.userId,
    productId: o.productId,
    type: "stripe",
    status: "pending",
    amountPaid: 5000,
    currency: "CAD",
    stripeSessionId: o.sessionId,
    accessType: o.accessType,
    durationDays: o.durationDays,
    accessExpiresAt: new Date(Date.now() + o.durationDays * DAY),
    createdAt: new Date(),
  })

const approxDays = (expiresAt: Date, days: number) => {
  const diffDays = (expiresAt.getTime() - Date.now()) / DAY
  return diffDays > days - 0.01 && diffDays < days + 0.01
}

beforeAll(async () => {
  await db.insert(user).values(
    U.map((id, i) => ({
      id,
      name: `Stripe ${suffix} ${i}`,
      email: `${id.slice(0, 6)}-${suffix}@test.invalid`,
    })),
  )
  await db.insert(products).values([
    {
      id: PEXAM,
      code: "exam_access",
      name: `Exam ${suffix}`,
      description: "desc",
      priceCad: 5000,
      durationDays: 90,
      accessType: "exam",
      isCombo: false,
      stripeProductId: `prod_e_${suffix}`,
      stripePriceId: `price_e_${suffix}`,
    },
    {
      id: PCOMBO,
      code: "premium_access",
      name: `Combo ${suffix}`,
      description: "desc",
      priceCad: 9000,
      durationDays: 30,
      accessType: "exam",
      isCombo: true,
      stripeProductId: `prod_c_${suffix}`,
      stripePriceId: `price_c_${suffix}`,
    },
  ])
})

afterAll(async () => {
  await db.delete(userAccess).where(inArray(userAccess.userId, U))
  await db.delete(transactions).where(inArray(transactions.userId, U))
  await db.delete(products).where(inArray(products.id, [PEXAM, PCOMBO]))
  await db.delete(user).where(inArray(user.id, U))
})

describe("completeStripeTransaction", () => {
  it("non-combo : complète la transaction et crédite l'accès (now + durée)", async () => {
    const txId = createId()
    const sid = `sess_happy_${suffix}`
    await seedPending({
      id: txId,
      userId: U_HAPPY,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 90,
    })

    const res = await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_happy",
      stripeEventId: `evt_happy_${suffix}`,
    })
    expect(res).toEqual({ status: "completed", transactionId: txId })

    const tx = await txStatus(txId)
    expect(tx?.status).toBe("completed")
    expect(tx?.completedAt).not.toBeNull()
    expect(tx?.pi).toBe("pi_happy")

    const acc = await accessOf(U_HAPPY, "exam")
    expect(acc?.lastTransactionId).toBe(txId)
    expect(approxDays(acc!.expiresAt, 90)).toBe(true)
  })

  it("idempotent : même event rejoué → already_processed, pas de double crédit", async () => {
    const before = await accessOf(U_HAPPY, "exam")
    const res = await completeStripeTransaction({
      stripeSessionId: `sess_happy_${suffix}`,
      stripePaymentIntentId: "pi_happy",
      stripeEventId: `evt_happy_${suffix}`,
    })
    expect(res).toEqual({ status: "already_processed" })
    const after = await accessOf(U_HAPPY, "exam")
    expect(after?.expiresAt.getTime()).toBe(before?.expiresAt.getTime())
  })

  it("idempotent : transaction déjà complétée (autre event) → already_processed", async () => {
    const before = await accessOf(U_HAPPY, "exam")
    const res = await completeStripeTransaction({
      stripeSessionId: `sess_happy_${suffix}`,
      stripePaymentIntentId: "pi_happy",
      stripeEventId: `evt_happy_other_${suffix}`,
    })
    expect(res).toEqual({ status: "already_processed" })
    const after = await accessOf(U_HAPPY, "exam")
    expect(after?.expiresAt.getTime()).toBe(before?.expiresAt.getTime())
  })

  it("cumul non-combo : accès existant + durée", async () => {
    // Accès exam existant à +10j (lastTransactionId = une transaction préalable).
    const priorTx = createId()
    await db.insert(transactions).values({
      id: priorTx,
      userId: U_CUMUL,
      productId: PEXAM,
      type: "manual",
      status: "completed",
      amountPaid: 5000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 10,
      accessExpiresAt: new Date(Date.now() + 10 * DAY),
      createdAt: new Date(),
      completedAt: new Date(),
    })
    await db.insert(userAccess).values({
      userId: U_CUMUL,
      accessType: "exam",
      expiresAt: new Date(Date.now() + 10 * DAY),
      lastTransactionId: priorTx,
    })

    const txId = createId()
    const sid = `sess_cumul_${suffix}`
    await seedPending({
      id: txId,
      userId: U_CUMUL,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 90,
    })

    const res = await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_cumul",
      stripeEventId: `evt_cumul_${suffix}`,
    })
    expect(res.status).toBe("completed")

    const acc = await accessOf(U_CUMUL, "exam")
    // Cumul : ~10 + 90 = 100 jours.
    expect(approxDays(acc!.expiresAt, 100)).toBe(true)
    expect(acc?.lastTransactionId).toBe(txId)
  })

  it("combo : crédite exam ET training (now + durée)", async () => {
    const txId = createId()
    const sid = `sess_combo_${suffix}`
    await seedPending({
      id: txId,
      userId: U_COMBO,
      productId: PCOMBO,
      sessionId: sid,
      accessType: "exam",
      durationDays: 30,
    })

    const res = await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_combo",
      stripeEventId: `evt_combo_${suffix}`,
    })
    expect(res.status).toBe("completed")

    const exam = await accessOf(U_COMBO, "exam")
    const training = await accessOf(U_COMBO, "training")
    expect(approxDays(exam!.expiresAt, 30)).toBe(true)
    expect(approxDays(training!.expiresAt, 30)).toBe(true)
    expect(exam?.lastTransactionId).toBe(txId)
    expect(training?.lastTransactionId).toBe(txId)
  })

  it("session inconnue → not_found", async () => {
    const res = await completeStripeTransaction({
      stripeSessionId: `sess_ghost_${suffix}`,
      stripePaymentIntentId: "pi_ghost",
      stripeEventId: `evt_ghost_${suffix}`,
    })
    expect(res).toEqual({ status: "not_found" })
  })
})

describe("failStripeTransaction", () => {
  it("expired : marque la transaction failed", async () => {
    const txId = createId()
    const sid = `sess_fail_${suffix}`
    await seedPending({
      id: txId,
      userId: U_FAIL,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 90,
    })

    const res = await failStripeTransaction({
      stripeSessionId: sid,
      stripeEventId: `evt_fail_${suffix}`,
    })
    expect(res).toEqual({ status: "failed" })
    expect((await txStatus(txId))?.status).toBe("failed")
    // Aucun accès crédité.
    expect(await accessOf(U_FAIL, "exam")).toBeUndefined()
  })

  it("ne touche pas une transaction déjà complétée", async () => {
    const txId = createId()
    const sid = `sess_faildone_${suffix}`
    await seedPending({
      id: txId,
      userId: U_FAILDONE,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 90,
    })
    await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_fd",
      stripeEventId: `evt_fd_complete_${suffix}`,
    })

    const res = await failStripeTransaction({
      stripeSessionId: sid,
      stripeEventId: `evt_fd_expire_${suffix}`,
    })
    expect(res).toEqual({ status: "already_processed" })
    expect((await txStatus(txId))?.status).toBe("completed")
  })
})
