import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { rebuildFromTransactions } from "@/features/payments/access-ledger"
import {
  type AccessImpact,
  type TransactionStatsView,
  getAllTransactions,
  getTransactionAccessImpact,
  getTransactionStats,
} from "@/features/payments/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

// `cache()` de React → identité (pas de contexte RSC en test node).
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
// Garde admin mockée : on isole la logique DB.
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const uid = createId()
// Accès offert (montant nul) : ne fait pas un acheteur.
const freeUid = createId()
const pid = createId()

// Jeu connu : 4 complétées (CAD old 10000, CAD stripe recent 5000, XAF manual
// recent 300000, CAD manual recent 1), 1 remboursée (exclue stats), 1 pending.
const txCadManualOld = createId()
const txCadStripeRecent = createId()
const txXafManualRecent = createId()
const txRefunded = createId()
const txPending = createId()
const lastTxId = createId()

// Baseline capturé AVANT seed : les assertions portent sur l'écart, pas sur un total.
let baseline: TransactionStatsView

const insertTx = (o: {
  id: string
  type: "manual" | "stripe"
  status: "completed" | "refunded" | "pending"
  currency: "CAD" | "XAF"
  amountPaid: number
  createdAt: Date
  completedAt: Date | null
}) =>
  db.insert(transactions).values({
    id: o.id,
    userId: uid,
    productId: pid,
    type: o.type,
    status: o.status,
    amountPaid: o.amountPaid,
    currency: o.currency,
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(Date.now() + 90 * DAY),
    createdAt: o.createdAt,
    completedAt: o.completedAt,
  })

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: uid, role: "admin" },
  } as never)

  baseline = await getTransactionStats()

  await db.insert(user).values([
    {
      id: uid,
      name: `IT Admin ${suffix}`,
      email: `admin-${suffix}@test.invalid`,
    },
    {
      id: freeUid,
      name: `IT Offert ${suffix}`,
      email: `offert-${suffix}@test.invalid`,
    },
  ])
  await db.insert(products).values({
    id: pid,
    code: "exam_access",
    name: "Exam",
    description: "d",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
    stripePriceLookupKey: `price_${suffix}`,
  })

  const now = Date.now()
  const recent = new Date(now - DAY) // < 30 jours
  const old = new Date(now - 60 * DAY) // > 30 jours

  await insertTx({
    id: txCadManualOld,
    type: "manual",
    status: "completed",
    currency: "CAD",
    amountPaid: 10000,
    createdAt: old,
    completedAt: old,
  })
  await insertTx({
    id: txCadStripeRecent,
    type: "stripe",
    status: "completed",
    currency: "CAD",
    amountPaid: 5000,
    createdAt: recent,
    completedAt: recent,
  })
  await insertTx({
    id: txXafManualRecent,
    type: "manual",
    status: "completed",
    currency: "XAF",
    amountPaid: 300000,
    createdAt: recent,
    completedAt: recent,
  })
  await insertTx({
    id: txRefunded,
    type: "manual",
    status: "refunded",
    currency: "CAD",
    amountPaid: 9999,
    createdAt: recent,
    completedAt: recent,
  })
  await insertTx({
    id: txPending,
    type: "stripe",
    status: "pending",
    currency: "CAD",
    amountPaid: 8888,
    createdAt: recent,
    completedAt: null,
  })
  await insertTx({
    id: lastTxId,
    type: "manual",
    status: "completed",
    currency: "CAD",
    amountPaid: 1,
    createdAt: recent,
    completedAt: recent,
  })

  await db.insert(transactions).values({
    id: createId(),
    userId: freeUid,
    productId: pid,
    type: "manual",
    status: "completed",
    amountPaid: 0,
    currency: "CAD",
    notes: "Accès offert",
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(now + 90 * DAY),
    createdAt: recent,
    completedAt: recent,
  })

  await db.insert(userAccess).values({
    userId: uid,
    accessType: "exam",
    expiresAt: new Date(now + 10 * DAY),
    lastTransactionId: lastTxId,
  })
})

afterAll(async () => {
  await db.delete(userAccess).where(eq(userAccess.userId, uid))
  await db
    .delete(transactions)
    .where(inArray(transactions.userId, [uid, freeUid]))
  await db.delete(products).where(eq(products.id, pid))
  await db.delete(user).where(inArray(user.id, [uid, freeUid]))
})

describe("getTransactionStats (agrégation SQL FILTER + fenêtre 30j)", () => {
  it("agrège revenus et compteurs par devise (delta vs baseline)", async () => {
    const after = await getTransactionStats()

    // CAD : total = 10000 + 5000 + 1 (remboursée et pending exclues).
    expect(
      after.revenueByCurrency.CAD.total - baseline.revenueByCurrency.CAD.total,
    ).toBe(15001)
    // CAD récent (≤30j) : 5000 + 1 (la 10000 est vieille de 60j).
    expect(
      after.revenueByCurrency.CAD.recent -
        baseline.revenueByCurrency.CAD.recent,
    ).toBe(5001)
    // XAF : total et récent = 300000.
    expect(
      after.revenueByCurrency.XAF.total - baseline.revenueByCurrency.XAF.total,
    ).toBe(300000)
    expect(
      after.revenueByCurrency.XAF.recent -
        baseline.revenueByCurrency.XAF.recent,
    ).toBe(300000)
  })

  it("compte les acheteurs (montant > 0) et toutes les transactions, tous statuts", async () => {
    const after = await getTransactionStats()
    // uid a payé ; freeUid n'a reçu qu'un accès offert.
    expect(after.buyerCount - baseline.buyerCount).toBe(1)
    // 6 transactions pour uid (remboursée et pending comprises) + 1 offerte.
    expect(after.transactionCount - baseline.transactionCount).toBe(7)
  })
})

describe("getAllTransactions (admin : filtres + keyset)", () => {
  it("renvoie toutes les transactions de l'utilisateur, jointures user/produit peuplées", async () => {
    const page = await getAllTransactions({ userId: uid })
    expect(page.items).toHaveLength(6)
    expect(
      page.items.every((t) => t.user?.email === `admin-${suffix}@test.invalid`),
    ).toBe(true)
    expect(page.items.every((t) => t.product?.name === "Exam")).toBe(true)
  })

  it("pagine en keyset sans doublon ni saut", async () => {
    const page1 = await getAllTransactions({ userId: uid, limit: 4 })
    expect(page1.items).toHaveLength(4)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await getAllTransactions({
      userId: uid,
      cursor: page1.nextCursor,
      limit: 4,
    })
    const ids = [...page1.items, ...page2.items].map((t) => t.id)
    expect(new Set(ids).size).toBe(6) // 4 + 2, aucun doublon
    expect(page2.nextCursor).toBeNull()
  })

  it("expose le statut de litige de chaque transaction", async () => {
    await db
      .update(transactions)
      .set({ stripeDisputeId: "dp_admin", disputeStatus: "needs_response" })
      .where(eq(transactions.id, txCadStripeRecent))

    const page = await getAllTransactions({ userId: uid, limit: 50 })
    const disputed = page.items.find((t) => t.id === txCadStripeRecent)
    const clean = page.items.find((t) => t.id === txCadManualOld)

    expect(disputed?.disputeStatus).toBe("needs_response")
    expect(clean?.disputeStatus).toBeNull()
  })
})

const impactOn = (
  impacts: AccessImpact[] | null,
  accessType: "exam" | "training",
) => impacts?.find((i) => i.accessType === accessType)

describe("getTransactionAccessImpact", () => {
  it("willAffectAccess=false quand les transactions restantes couvrent autant ou plus (même pour lastTransactionId)", async () => {
    // lastTxId est bien lastTransactionId de l'accès (+10 j), mais les autres
    // transactions complétées couvrent ~ +90 j : la retirer n'ABAISSE pas
    // l'accès : un critère `lastTransactionId === txId` mentirait ici.
    const exam = impactOn(await getTransactionAccessImpact(lastTxId), "exam")
    expect(exam?.willAffectAccess).toBe(false)
    expect(exam?.currentAccessExpiresAt).not.toBeNull()
    expect(exam?.restoredExpiresAt).not.toBeNull()
  })

  it("willAffectAccess=false pour une transaction non déterminante", async () => {
    const impacts = await getTransactionAccessImpact(txCadManualOld)
    expect(impacts?.some((i) => i.willAffectAccess)).toBe(false)
  })

  it("willAffectAccess=true quand la transaction porte seule l'échéance courante", async () => {
    // lastTxId devient l'unique couverture à +200 j : sans elle, l'accès
    // retomberait à ~ +90 j (le max des transactions restantes).
    const farOut = new Date(Date.now() + 200 * DAY)
    await db
      .update(transactions)
      .set({ accessExpiresAt: farOut })
      .where(eq(transactions.id, lastTxId))
    await db
      .update(userAccess)
      .set({ expiresAt: farOut })
      .where(eq(userAccess.userId, uid))

    const exam = impactOn(await getTransactionAccessImpact(lastTxId), "exam")
    expect(exam?.willAffectAccess).toBe(true)
    expect(exam?.restoredExpiresAt).not.toBeNull()
    expect(exam!.restoredExpiresAt!).toBeLessThan(exam!.currentAccessExpiresAt!)
  })

  it("renvoie null pour une transaction inexistante", async () => {
    const impact = await getTransactionAccessImpact(createId())
    expect(impact).toBeNull()
  })
})

// Un combo est enregistré avec `accessType: "exam"` mais couvre les DEUX types :
// l'aperçu doit annoncer, type par type, ce que la reconstruction fera ensuite.
describe("getTransactionAccessImpact — combo", () => {
  const comboPid = createId()
  const comboUsers: string[] = []

  beforeAll(async () => {
    await db.insert(products).values({
      id: comboPid,
      code: "premium_access",
      name: "Premium",
      description: "d",
      priceCad: 9000,
      durationDays: 60,
      accessType: "exam",
      isCombo: true,
      stripeProductId: `prod_combo_${suffix}`,
      stripePriceId: `price_combo_${suffix}`,
      stripePriceLookupKey: `price_combo_${suffix}`,
    })
  })

  afterAll(async () => {
    await db.delete(userAccess).where(inArray(userAccess.userId, comboUsers))
    await db
      .delete(transactions)
      .where(inArray(transactions.userId, comboUsers))
    await db.delete(products).where(eq(products.id, comboPid))
    await db.delete(user).where(inArray(user.id, comboUsers))
  })

  /**
   * Un utilisateur, ses transactions `completed` (snapshot à +N jours) et ses
   * lignes `user_access` alignées sur la meilleure couverture de chaque type.
   */
  const seed = async (
    txs: {
      kind: "combo" | "exam" | "training"
      days: number
      status?: "completed" | "refunded"
    }[],
  ) => {
    const userId = createId()
    comboUsers.push(userId)
    await db.insert(user).values({
      id: userId,
      name: `IT Combo ${suffix}`,
      email: `combo-${userId}@test.invalid`,
    })
    const now = Date.now()
    const rows = txs.map((t) => ({
      id: createId(),
      userId,
      productId: t.kind === "combo" ? comboPid : pid,
      type: "manual" as const,
      status: t.status ?? ("completed" as const),
      amountPaid: 1,
      currency: "CAD" as const,
      accessType:
        t.kind === "training" ? ("training" as const) : ("exam" as const),
      durationDays: t.days,
      accessExpiresAt: new Date(now + t.days * DAY),
      createdAt: new Date(now - DAY),
      completedAt: new Date(now - DAY),
    }))
    await db.insert(transactions).values(rows)
    for (const accessType of ["exam", "training"] as const) {
      const covering = rows.filter(
        (r, i) =>
          r.status === "completed" &&
          (txs[i].kind === "combo" || r.accessType === accessType),
      )
      if (covering.length === 0) continue
      const best = covering.reduce((a, b) =>
        a.accessExpiresAt > b.accessExpiresAt ? a : b,
      )
      await db.insert(userAccess).values({
        userId,
        accessType,
        expiresAt: best.accessExpiresAt,
        lastTransactionId: best.id,
      })
    }
    return { userId, ids: rows.map((r) => r.id) }
  }

  const snapshotOf = (transactionId: string) =>
    db
      .select({ at: transactions.accessExpiresAt })
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .then((r) => r[0].at.getTime())

  /** Applique la vraie reconstruction et relit `user_access` par type. */
  const accessAfterRebuild = async (userId: string, excluded: string) => {
    await db.transaction((tx) =>
      rebuildFromTransactions(tx, { userId, excludeTransactionId: excluded }),
    )
    const rows = await db
      .select({
        accessType: userAccess.accessType,
        expiresAt: userAccess.expiresAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, userId))
    return (accessType: "exam" | "training") =>
      rows.find((r) => r.accessType === accessType)?.expiresAt.getTime() ?? null
  }

  it("annonce le retrait de l'accès entraînement quand le combo en est la seule couverture", async () => {
    // exam : un achat simple à +90 j couvre plus loin que le combo (+60 j) ;
    // training : seul le combo le couvre.
    const { userId, ids } = await seed([
      { kind: "combo", days: 60 },
      { kind: "exam", days: 90 },
    ])
    const [comboId, examId] = ids

    const impacts = await getTransactionAccessImpact(comboId)
    expect(impactOn(impacts, "exam")?.willAffectAccess).toBe(false)
    expect(impactOn(impacts, "training")).toMatchObject({
      willAffectAccess: true,
      restoredExpiresAt: null,
    })

    const after = await accessAfterRebuild(userId, comboId)
    expect(after("training")).toBeNull()
    expect(after("exam")).toBe(await snapshotOf(examId))
  })

  it("annonce le raccourcissement des deux accès quand le combo porte les deux échéances", async () => {
    const { userId, ids } = await seed([
      { kind: "combo", days: 200 },
      { kind: "exam", days: 90 },
      { kind: "training", days: 30 },
    ])
    const [comboId, examId, trainingId] = ids
    const examAt = await snapshotOf(examId)
    const trainingAt = await snapshotOf(trainingId)

    const impacts = await getTransactionAccessImpact(comboId)
    expect(impactOn(impacts, "exam")).toMatchObject({
      willAffectAccess: true,
      restoredExpiresAt: examAt,
    })
    expect(impactOn(impacts, "training")).toMatchObject({
      willAffectAccess: true,
      restoredExpiresAt: trainingAt,
    })

    const after = await accessAfterRebuild(userId, comboId)
    expect(after("exam")).toBe(examAt)
    expect(after("training")).toBe(trainingAt)
  })

  it("transaction remboursée : aucun type annoncé touché, la reconstruction ne change rien", async () => {
    const { userId, ids } = await seed([
      { kind: "exam", days: 90 },
      { kind: "exam", days: 200, status: "refunded" },
    ])
    const [examId, refundedId] = ids
    const examAt = await snapshotOf(examId)

    const impacts = await getTransactionAccessImpact(refundedId)
    expect(impacts?.some((i) => i.willAffectAccess)).toBe(false)

    const after = await accessAfterRebuild(userId, refundedId)
    expect(after("exam")).toBe(examAt)
    expect(after("training")).toBeNull()
  })
})
