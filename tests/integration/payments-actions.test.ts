import { and, eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { lockUser } from "@/features/payments/access-ledger"
import {
  deleteManualTransaction,
  recordManualPayment,
  updateManualTransaction,
} from "@/features/payments/actions"
import { getTransactionAccessImpact } from "@/features/payments/dal"
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
const COMBO_USER_ID = createId()
const PID = createId()
const EXAM_PID = createId()

const accessRow = (accessType: "exam" | "training", userId: string = USER_ID) =>
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

/**
 * Tient le verrou `user` dans une transaction a part. Les actions lancees
 * pendant ce temps lisent la transaction PUIS attendent derriere ce verrou :
 * l'entrelacement « deux lectures avant le premier commit » est force au lieu
 * d'etre laisse au hasard du pool.
 */
const holdUserLock = async (userId: string) => {
  let release!: () => void
  const released = new Promise<void>((r) => (release = r))
  let locked!: () => void
  const isLocked = new Promise<void>((r) => (locked = r))
  const holder = db.transaction(async (tx) => {
    await lockUser(tx, userId)
    locked()
    await released
  })
  await isLocked

  return {
    /** Attend que `n` connexions soient bloquees sur un verrou. */
    waitForWaiters: async (n: number) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const res = await db.execute(sql`
          select count(*)::int as n from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'
        `)
        if ((res.rows[0] as { n: number }).n >= n) return
        await new Promise((r) => setTimeout(r, 25))
      }
      throw new Error(`${n} attente(s) de verrou jamais observee(s)`)
    },
    release: async () => {
      release()
      await holder
    },
  }
}

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
    {
      id: COMBO_USER_ID,
      name: `Combo ${suffix}`,
      email: `combo-${suffix}@test.invalid`,
    },
  ])
  await db.insert(products).values([
    {
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
    },
    {
      id: EXAM_PID,
      code: "exam_access",
      name: `Examens ${suffix}`,
      description: "desc",
      priceCad: 5000,
      durationDays: 30,
      accessType: "exam",
      stripeProductId: `prod_exam_${suffix}`,
      stripePriceId: `price_exam_${suffix}`,
      stripePriceLookupKey: `price_exam_${suffix}`,
    },
  ])
  mocks.adminId.current = ADMIN_ID
})

afterAll(async () => {
  // FK restrict : les lignes d'acces referencent les transactions.
  const seeded = [USER_ID, COMBO_USER_ID]
  await db.delete(userAccess).where(inArray(userAccess.userId, seeded))
  await db.delete(transactions).where(inArray(transactions.userId, seeded))
  await db.delete(products).where(inArray(products.id, [PID, EXAM_PID]))
  await db.delete(user).where(inArray(user.id, seeded))
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

  it("renvoie l'expiration resultante par acces, lue du registre, et l'echeance precedente", async () => {
    const before = await accessRow("exam")
    const res = await recordManualPayment(manualInput)
    expect(res.success).toBe(true)

    const after = await accessRow("exam")
    expect(res.grants).toEqual([
      {
        accessType: "exam",
        expiresAt: after.expiresAt.getTime(),
        previousExpiresAt: before?.expiresAt.getTime() ?? null,
      },
    ])
  })

  it("acces offert a 0 $ : accepte avec un motif, sans moyen de paiement", async () => {
    const res = await recordManualPayment({
      ...manualInput,
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

  it("acces offert sans motif → refus, aucune transaction ecrite", async () => {
    const count = async () =>
      (
        await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.userId, USER_ID))
      ).length
    const before = await count()

    const res = await recordManualPayment({
      ...manualInput,
      amountPaid: 0,
      paymentMethod: undefined,
      notes: "ok",
    })
    expect(res).toEqual({
      success: false,
      error: "Indiquez le motif de la gratuité (5 caractères au moins).",
    })
    expect(await count()).toBe(before)
  })

  it("paiement non nul sans moyen → refus", async () => {
    const res = await recordManualPayment({
      ...manualInput,
      paymentMethod: undefined,
    })
    expect(res).toEqual({
      success: false,
      error: "Méthode de paiement requise",
    })
  })

  it("compte supprime → refus, aucune transaction ecrite", async () => {
    const deletedId = createId()
    await db.insert(user).values({
      id: deletedId,
      name: `Suppr ${suffix}`,
      email: `suppr-${suffix}@test.invalid`,
      deletedAt: new Date(),
    })
    const res = await recordManualPayment({ ...manualInput, userId: deletedId })
    expect(res).toEqual({ success: false, error: "Utilisateur introuvable" })
    const rows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.userId, deletedId))
    expect(rows).toHaveLength(0)
    await db.delete(user).where(eq(user.id, deletedId))
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
  it("un paiement manuel en attente ne se complete pas par une modification", async () => {
    const pendingId = createId()
    await db.insert(transactions).values({
      id: pendingId,
      userId: USER_ID,
      productId: PID,
      type: "manual",
      status: "pending",
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "interac",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: new Date(Date.now() + 86_400_000),
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
    await db.delete(transactions).where(eq(transactions.id, pendingId))
  })

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

  it("combo : l'aperçu annonce type par type ce que la suppression fait ensuite", async () => {
    // Combo puis accès examen simple : l'examen cumule au-delà du combo, seul
    // le combo couvre l'entraînement.
    const comboId = await record({
      userId: COMBO_USER_ID,
      productCode: "premium_access",
    })
    await record({ userId: COMBO_USER_ID, productCode: "exam_access" })
    const examBefore = (await accessRow("exam", COMBO_USER_ID)).expiresAt

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
    expect(await accessRow("training", COMBO_USER_ID)).toBeUndefined()
    expect((await accessRow("exam", COMBO_USER_ID)).expiresAt).toEqual(
      examBefore,
    )
  })

  it("double suppression concurrente : une seule reussit, l'autre dit introuvable", async () => {
    const transactionId = await record()
    const lock = await holdUserLock(USER_ID)

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

  it("modification lancee pendant une suppression : introuvable, rien d'ecrit", async () => {
    const transactionId = await record()
    const lock = await holdUserLock(USER_ID)

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
