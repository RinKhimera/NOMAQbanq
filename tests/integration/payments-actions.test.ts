import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  deleteManualTransaction,
  recordManualPayment,
  updateManualTransaction,
} from "@/features/payments/actions"
import type { RecordManualPaymentInput } from "@/features/payments/schemas"
import { createId } from "@/lib/ids"

// Complement DB de tests/features/payments-actions.test.ts : ici on execute le
// corps des `db.transaction` (resolution produit, verrous, recompute d'acces),
// que le fichier unitaire simule au niveau du resultat.
const { mocks } = vi.hoisted(() => ({
  mocks: { adminId: { current: "" } },
}))

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({
    user: { id: mocks.adminId.current, email: "adm@test.invalid" },
  })),
  requireRole: vi.fn(async () => ({
    user: { id: mocks.adminId.current, role: "admin" },
  })),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const suffix = createId().slice(0, 8)
const ADMIN_ID = createId()
const USER_ID = createId()
const PID = createId()

const accessRow = (accessType: "exam" | "training") =>
  db
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
    })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, USER_ID),
        eq(userAccess.accessType, accessType),
      ),
    )
    .then((r) => r[0])

const manualInput: RecordManualPaymentInput = {
  userId: USER_ID,
  productCode: "exam_access",
  amountPaid: 5000,
  currency: "CAD",
  paymentMethod: "Virement Interac",
}

/** Enregistre un paiement manuel et renvoie l'id de transaction (echoue sinon). */
const record = async (
  overrides: Partial<RecordManualPaymentInput> = {},
): Promise<string> => {
  const res = await recordManualPayment({ ...manualInput, ...overrides })
  expect(res.success).toBe(true)
  return res.transactionId!
}

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: `Adm ${suffix}`,
      email: `adm-${suffix}@test.invalid`,
    },
    { id: USER_ID, name: `Usr ${suffix}`, email: `usr-${suffix}@test.invalid` },
  ])
  await db.insert(products).values({
    id: PID,
    code: "premium_access",
    name: `Combo ${suffix}`,
    description: "desc",
    priceCad: 9000,
    durationDays: 30,
    accessType: "exam",
    isCombo: true,
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
    stripePriceLookupKey: `price_${suffix}`,
  })
  mocks.adminId.current = ADMIN_ID
})

afterAll(async () => {
  // FK restrict : les lignes d'acces referencent les transactions.
  await db.delete(userAccess).where(eq(userAccess.userId, USER_ID))
  await db.delete(transactions).where(eq(transactions.userId, USER_ID))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(eq(user.id, USER_ID))
  await db.delete(user).where(eq(user.id, ADMIN_ID))
})

describe("recordManualPayment (DB)", () => {
  it("cree une transaction manuelle completee, tracee par l'admin, et ouvre l'acces", async () => {
    const transactionId = await record()

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(tx.type).toBe("manual")
    expect(tx.status).toBe("completed")
    expect(tx.userId).toBe(USER_ID)
    expect(tx.recordedBy).toBe(ADMIN_ID)
    expect(tx.amountPaid).toBe(5000)
    expect(tx.paymentMethod).toBe("Virement Interac")
    expect(tx.completedAt).not.toBeNull()

    const access = await accessRow(tx.accessType)
    expect(access.lastTransactionId).toBe(transactionId)
    expect(access.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it("produit combo : ouvre exam ET training sur la meme transaction", async () => {
    const transactionId = await record({ productCode: "premium_access" })

    for (const type of ["exam", "training"] as const) {
      const access = await accessRow(type)
      expect(access.lastTransactionId).toBe(transactionId)
    }
  })

  it("utilisateur inexistant → erreur metier, aucune transaction ecrite", async () => {
    const ghostId = createId()
    const res = await recordManualPayment({ ...manualInput, userId: ghostId })
    expect(res).toEqual({ success: false, error: "Utilisateur introuvable" })

    const rows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.userId, ghostId))
    expect(rows).toHaveLength(0)
  })
})

describe("updateManualTransaction (DB)", () => {
  it("modifie montant, methode et notes d'une transaction manuelle", async () => {
    const transactionId = await record()

    const res = await updateManualTransaction({
      transactionId,
      amountPaid: 7500,
      currency: "CAD",
      paymentMethod: "Comptant",
      notes: "  regularisation  ",
    })
    expect(res).toEqual({ success: true })

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(tx.amountPaid).toBe(7500)
    expect(tx.paymentMethod).toBe("Comptant")
    expect(tx.notes).toBe("regularisation")
    // Statut absent de l'entree : conserve, et aucun recompute declenche.
    expect(tx.status).toBe("completed")
  })

  it("completed → refunded : l'acces retombe sur la transaction precedente", async () => {
    const first = await record()
    const firstExpiry = (await accessRow("exam")).expiresAt
    const second = await record()
    const afterSecond = await accessRow("exam")
    expect(afterSecond.lastTransactionId).toBe(second)
    expect(afterSecond.expiresAt.getTime()).toBeGreaterThan(
      firstExpiry.getTime(),
    )

    const res = await updateManualTransaction({
      transactionId: second,
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "Virement Interac",
      status: "refunded",
    })
    expect(res).toEqual({ success: true })

    const restored = await accessRow("exam")
    expect(restored.lastTransactionId).toBe(first)
    expect(restored.expiresAt.getTime()).toBe(firstExpiry.getTime())
  })

  it("transaction Stripe → refus (seul le manuel est modifiable)", async () => {
    const stripeTxId = createId()
    await db.insert(transactions).values({
      id: stripeTxId,
      userId: USER_ID,
      productId: PID,
      type: "stripe",
      status: "completed",
      amountPaid: 9000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: new Date(Date.now() + 86_400_000),
      stripeSessionId: `cs_${suffix}`,
    })

    const res = await updateManualTransaction({
      transactionId: stripeTxId,
      amountPaid: 1,
      currency: "CAD",
      paymentMethod: "Comptant",
    })
    expect(res).toEqual({
      success: false,
      error: "Seules les transactions manuelles peuvent être modifiées",
    })

    const [tx] = await db
      .select({ amountPaid: transactions.amountPaid })
      .from(transactions)
      .where(eq(transactions.id, stripeTxId))
    expect(tx.amountPaid).toBe(9000)
  })

  it("transaction inexistante → erreur metier", async () => {
    const res = await updateManualTransaction({
      transactionId: createId(),
      amountPaid: 1000,
      currency: "CAD",
      paymentMethod: "Comptant",
    })
    expect(res).toEqual({ success: false, error: "Transaction introuvable" })
  })
})

describe("deleteManualTransaction (DB)", () => {
  it("supprime la transaction et signale la reduction d'acces (FK restrict franchie)", async () => {
    const transactionId = await record()
    expect((await accessRow("exam")).lastTransactionId).toBe(transactionId)

    const res = await deleteManualTransaction(transactionId)
    expect(res.success).toBe(true)
    expect(res.accessRevoked).toBe(true)

    const rows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(rows).toHaveLength(0)

    const access = await accessRow("exam")
    expect(access?.lastTransactionId).not.toBe(transactionId)
  })

  it("transaction Stripe → refus, la ligne reste en base", async () => {
    const stripeTxId = createId()
    await db.insert(transactions).values({
      id: stripeTxId,
      userId: USER_ID,
      productId: PID,
      type: "stripe",
      status: "completed",
      amountPaid: 9000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: new Date(Date.now() + 86_400_000),
      stripeSessionId: `cs_del_${suffix}`,
    })

    const res = await deleteManualTransaction(stripeTxId)
    expect(res).toEqual({
      success: false,
      error: "Seules les transactions manuelles peuvent être supprimées",
    })

    const rows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.id, stripeTxId))
    expect(rows).toHaveLength(1)
  })

  it("transaction inexistante → erreur metier", async () => {
    const res = await deleteManualTransaction(createId())
    expect(res).toEqual({ success: false, error: "Transaction introuvable" })
  })
})
