import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import {
  deleteManualTransaction,
  recordManualPayment,
  updateManualTransaction,
} from "@/features/payments/actions"
import { getTransactionAccessImpact } from "@/features/payments/dal"
import type { RecordManualPaymentInput } from "@/features/payments/schemas"
import { createId } from "@/lib/ids"
import { seedProduct } from "../helpers/seed-payments"
import { holdUserLock } from "../helpers/user-lock"

// Complément DB de tests/features/payments-actions.test.ts : ici on exécute le
// corps des `db.transaction` (résolution produit, verrous, recompute d'accès),
// que le fichier unitaire simule au niveau du résultat.
const { mocks } = vi.hoisted(() => ({
  mocks: { adminId: { current: "" } },
}))

vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({
    user: { id: mocks.adminId.current, email: "adm@test.invalid" },
  })),
  requireRole: vi.fn(async () => ({
    user: { id: mocks.adminId.current, role: "admin" },
  })),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const DAY = 86_400_000
const ADMIN_ID = createId()
let PID = ""

const newUser = async (over: Partial<typeof user.$inferInsert> = {}) => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: `Usr ${id}`, email: `usr-${id}@test.invalid`, ...over })
  return id
}

const accessRow = (accessType: "exam" | "training", userId: string) =>
  db
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
    })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .then((r) => r[0])

const manualInput = (userId: string): RecordManualPaymentInput => ({
  userId,
  productCode: "exam_access",
  amountPaid: 5000,
  currency: "CAD",
  paymentMethod: "Virement Interac",
})

/** Enregistre un paiement manuel et renvoie l'id de transaction (échoue sinon). */
const record = async (
  userId: string,
  overrides: Partial<RecordManualPaymentInput> = {},
): Promise<string> => {
  const res = await recordManualPayment({
    ...manualInput(userId),
    ...overrides,
  })
  expect(res.success).toBe(true)
  return res.transactionId!
}

const countTransactions = async (userId: string) =>
  (
    await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.userId, userId))
  ).length

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: ADMIN_ID, name: "Adm", email: "adm@test.invalid" })
  PID = await seedProduct("premium_access", { priceCad: 9000 })
  await seedProduct("exam_access")
  mocks.adminId.current = ADMIN_ID
})

describe("recordManualPayment (DB)", () => {
  it("crée une transaction manuelle complétée, tracée par l'admin, et ouvre l'accès", async () => {
    const userId = await newUser()
    const res = await recordManualPayment(manualInput(userId))
    expect(res.success).toBe(true)

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, res.transactionId!))
    expect(tx).toMatchObject({
      type: "manual",
      status: "completed",
      userId,
      recordedBy: ADMIN_ID,
      amountPaid: 5000,
      paymentMethod: "Virement Interac",
    })
    expect(tx.completedAt).not.toBeNull()

    const access = await accessRow(tx.accessType, userId)
    expect(access.lastTransactionId).toBe(res.transactionId)
    expect(access.expiresAt.getTime()).toBe(res.recordedAt! + 30 * DAY)
  })

  it("produit combo : ouvre exam ET training sur la même transaction", async () => {
    const userId = await newUser()
    const transactionId = await record(userId, {
      productCode: "premium_access",
    })

    for (const type of ["exam", "training"] as const) {
      const access = await accessRow(type, userId)
      expect(access.lastTransactionId).toBe(transactionId)
    }
  })

  it("renvoie l'expiration résultante par accès, lue du registre, et l'échéance précédente", async () => {
    const userId = await newUser()
    await record(userId)
    const before = await accessRow("exam", userId)
    const res = await recordManualPayment(manualInput(userId))
    expect(res.success).toBe(true)

    const after = await accessRow("exam", userId)
    expect(res.grants).toEqual([
      {
        accessType: "exam",
        expiresAt: after.expiresAt.getTime(),
        previousExpiresAt: before.expiresAt.getTime(),
      },
    ])
  })

  it("accès offert à 0 $ : accepté avec un motif, sans moyen de paiement", async () => {
    const userId = await newUser()
    const res = await recordManualPayment({
      ...manualInput(userId),
      amountPaid: 0,
      paymentMethod: undefined,
      notes: "  Examen interrompu par une panne  ",
    })
    expect(res.success).toBe(true)

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, res.transactionId!))
    expect(tx.amountPaid).toBe(0)
    expect(tx.paymentMethod).toBeNull()
    expect(tx.notes).toBe("Examen interrompu par une panne")
    expect(tx.status).toBe("completed")
  })

  it("accès offert sans motif → refus, aucune transaction écrite", async () => {
    const userId = await newUser()
    const res = await recordManualPayment({
      ...manualInput(userId),
      amountPaid: 0,
      paymentMethod: undefined,
      notes: "ok",
    })
    expect(res).toEqual({
      success: false,
      error: "Indiquez le motif de la gratuité (5 caractères au moins).",
    })
    expect(await countTransactions(userId)).toBe(0)
  })

  it("paiement non nul sans moyen → refus", async () => {
    const userId = await newUser()
    const res = await recordManualPayment({
      ...manualInput(userId),
      paymentMethod: undefined,
    })
    expect(res).toEqual({
      success: false,
      error: "Méthode de paiement requise",
    })
  })

  it("compte supprimé → refus, aucune transaction écrite", async () => {
    const deletedId = await newUser({ deletedAt: new Date() })
    const res = await recordManualPayment(manualInput(deletedId))
    expect(res).toEqual({ success: false, error: "Utilisateur introuvable" })
    expect(await countTransactions(deletedId)).toBe(0)
  })

  it("utilisateur inexistant → erreur métier, aucune transaction écrite", async () => {
    const ghostId = createId()
    const res = await recordManualPayment(manualInput(ghostId))
    expect(res).toEqual({ success: false, error: "Utilisateur introuvable" })
    expect(await countTransactions(ghostId)).toBe(0)
  })
})

describe("updateManualTransaction (DB)", () => {
  it("un paiement manuel en attente ne se complète pas par une modification", async () => {
    const userId = await newUser()
    const pendingId = createId()
    await db.insert(transactions).values({
      id: pendingId,
      userId,
      productId: PID,
      type: "manual",
      status: "pending",
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "interac",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: new Date(Date.now() + DAY),
    })
    const res = await updateManualTransaction({
      transactionId: pendingId,
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "interac",
      status: "completed",
    })
    expect(res).toEqual({
      success: false,
      error: "Seul un paiement complété ou remboursé change de statut",
    })
    const [row] = await db
      .select({ status: transactions.status })
      .from(transactions)
      .where(eq(transactions.id, pendingId))
    expect(row.status).toBe("pending")
  })

  it("modifie montant, méthode et notes d'une transaction manuelle", async () => {
    const transactionId = await record(await newUser())

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
    // Statut absent de l'entrée : conservé, et aucun recompute déclenché.
    expect(tx.status).toBe("completed")
  })

  it("completed → refunded : l'accès retombe sur la transaction précédente", async () => {
    const userId = await newUser()
    const first = await record(userId)
    const firstExpiry = (await accessRow("exam", userId)).expiresAt
    const second = await record(userId)
    const afterSecond = await accessRow("exam", userId)
    expect(afterSecond.lastTransactionId).toBe(second)
    expect(afterSecond.expiresAt.getTime()).toBe(
      firstExpiry.getTime() + 30 * DAY,
    )

    const res = await updateManualTransaction({
      transactionId: second,
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "Virement Interac",
      status: "refunded",
    })
    expect(res).toEqual({ success: true })

    const restored = await accessRow("exam", userId)
    expect(restored.lastTransactionId).toBe(first)
    expect(restored.expiresAt.getTime()).toBe(firstExpiry.getTime())
  })

  it("transaction Stripe → refus (seul le manuel est modifiable)", async () => {
    const stripeTxId = createId()
    await db.insert(transactions).values({
      id: stripeTxId,
      userId: await newUser(),
      productId: PID,
      type: "stripe",
      status: "completed",
      amountPaid: 9000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: new Date(Date.now() + DAY),
      stripeSessionId: `cs_${stripeTxId}`,
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

  it("transaction inexistante → erreur métier", async () => {
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
  it("supprime la transaction et signale la réduction d'accès (FK restrict franchie)", async () => {
    const userId = await newUser()
    const transactionId = await record(userId)
    expect((await accessRow("exam", userId)).lastTransactionId).toBe(
      transactionId,
    )

    const res = await deleteManualTransaction(transactionId)
    expect(res).toEqual({ success: true, accessRevoked: true })
    expect(await countTransactions(userId)).toBe(0)
    expect(await accessRow("exam", userId)).toBeUndefined()
  })

  it("transaction Stripe → refus, la ligne reste en base", async () => {
    const userId = await newUser()
    const stripeTxId = createId()
    await db.insert(transactions).values({
      id: stripeTxId,
      userId,
      productId: PID,
      type: "stripe",
      status: "completed",
      amountPaid: 9000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: new Date(Date.now() + DAY),
      stripeSessionId: `cs_${stripeTxId}`,
    })

    const res = await deleteManualTransaction(stripeTxId)
    expect(res).toEqual({
      success: false,
      error: "Seules les transactions manuelles peuvent être supprimées",
    })
    expect(await countTransactions(userId)).toBe(1)
  })

  it("transaction inexistante → erreur métier", async () => {
    const res = await deleteManualTransaction(createId())
    expect(res).toEqual({ success: false, error: "Transaction introuvable" })
  })

  it("combo : l'aperçu annonce type par type ce que la suppression fait ensuite", async () => {
    // Combo puis accès examen simple : l'examen cumule au-delà du combo, seul
    // le combo couvre l'entraînement.
    const userId = await newUser()
    const comboId = await record(userId, { productCode: "premium_access" })
    await record(userId, { productCode: "exam_access" })
    const examBefore = (await accessRow("exam", userId)).expiresAt

    const impacts = await getTransactionAccessImpact(comboId)
    const on = (type: "exam" | "training") =>
      impacts?.find((i) => i.accessType === type)
    expect(on("exam")?.willAffectAccess).toBe(false)
    expect(on("training")).toMatchObject({
      willAffectAccess: true,
      restoredExpiresAt: null,
    })

    const res = await deleteManualTransaction(comboId)
    expect(res).toEqual({ success: true, accessRevoked: true })
    expect(await accessRow("training", userId)).toBeUndefined()
    expect((await accessRow("exam", userId)).expiresAt).toEqual(examBefore)
  })

  it("double suppression concurrente : une seule réussit, l'autre dit introuvable", async () => {
    const userId = await newUser()
    const transactionId = await record(userId)
    const lock = await holdUserLock(userId)

    const first = deleteManualTransaction(transactionId)
    const second = deleteManualTransaction(transactionId)
    await lock.waitForWaiters(2)
    await lock.release()
    const results = await Promise.all([first, second])

    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(results.filter((r) => !r.success)).toEqual([
      { success: false, error: "Transaction introuvable" },
    ])
  })

  it("modification lancée pendant une suppression : introuvable, rien d'écrit", async () => {
    const userId = await newUser()
    const transactionId = await record(userId)
    const lock = await holdUserLock(userId)

    const deleting = deleteManualTransaction(transactionId)
    await lock.waitForWaiters(1)
    const updating = updateManualTransaction({
      transactionId,
      amountPaid: 1,
      currency: "CAD",
      paymentMethod: "Comptant",
      status: "refunded",
    })
    await lock.waitForWaiters(2)
    await lock.release()

    expect(await deleting).toEqual({ success: true, accessRevoked: true })
    expect(await updating).toEqual({
      success: false,
      error: "Transaction introuvable",
    })
  })
})
