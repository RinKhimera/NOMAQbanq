import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
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
const pid = createId()

// Jeu connu : 4 complétées (CAD old 10000, CAD stripe recent 5000, XAF manual
// recent 300000, CAD manual recent 1), 1 remboursée (exclue stats), 1 pending.
const txCadManualOld = createId()
const txCadStripeRecent = createId()
const txXafManualRecent = createId()
const txRefunded = createId()
const txPending = createId()
const lastTxId = createId()

// Baseline capturé AVANT seed (la branche éphémère hérite des données de `develop`).
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

  await db.insert(user).values({
    id: uid,
    name: `IT Admin ${suffix}`,
    email: `admin-${suffix}@test.invalid`,
  })
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

  await db.insert(userAccess).values({
    userId: uid,
    accessType: "exam",
    expiresAt: new Date(now + 10 * DAY),
    lastTransactionId: lastTxId,
  })
})

afterAll(async () => {
  await db.delete(userAccess).where(eq(userAccess.userId, uid))
  await db.delete(transactions).where(eq(transactions.userId, uid))
  await db.delete(products).where(eq(products.id, pid))
  await db.delete(user).where(eq(user.id, uid))
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

    // Compteurs (complétées uniquement).
    expect(after.totalTransactions - baseline.totalTransactions).toBe(4)
    expect(after.stripeTransactions - baseline.stripeTransactions).toBe(1)
    expect(after.manualTransactions - baseline.manualTransactions).toBe(3)
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

  it("filtre par type (stripe = complétée + pending)", async () => {
    const page = await getAllTransactions({ userId: uid, type: "stripe" })
    expect(page.items).toHaveLength(2)
    expect(page.items.every((t) => t.type === "stripe")).toBe(true)
  })

  it("filtre par statut (completed)", async () => {
    const page = await getAllTransactions({ userId: uid, status: "completed" })
    expect(page.items).toHaveLength(4)
    expect(page.items.every((t) => t.status === "completed")).toBe(true)
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
})

describe("getTransactionAccessImpact", () => {
  it("willAffectAccess=false quand les transactions restantes couvrent autant ou plus (même pour lastTransactionId)", async () => {
    // lastTxId est bien lastTransactionId de l'accès (+10 j), mais les autres
    // transactions complétées couvrent ~ +90 j : la retirer n'ABAISSE pas
    // l'accès. L'ancien critère (lastTransactionId === txId) aurait menti ici.
    const impact = await getTransactionAccessImpact(lastTxId)
    expect(impact?.willAffectAccess).toBe(false)
    expect(impact?.accessType).toBe("exam")
    expect(impact?.currentAccessExpiresAt).not.toBeNull()
    expect(impact?.restoredExpiresAt).not.toBeNull()
  })

  it("willAffectAccess=false pour une transaction non déterminante", async () => {
    const impact = await getTransactionAccessImpact(txCadManualOld)
    expect(impact?.willAffectAccess).toBe(false)
    expect(impact?.accessType).toBe("exam")
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

    const impact = await getTransactionAccessImpact(lastTxId)
    expect(impact?.willAffectAccess).toBe(true)
    expect(impact?.restoredExpiresAt).not.toBeNull()
    expect(impact!.restoredExpiresAt!).toBeLessThan(
      impact!.currentAccessExpiresAt!,
    )
  })

  it("renvoie null pour une transaction inexistante", async () => {
    const impact = await getTransactionAccessImpact(createId())
    expect(impact).toBeNull()
  })
})
