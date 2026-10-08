import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import { rebuildFromTransactions } from "@/features/payments/access-ledger"
import {
  type AccessImpact,
  getAllTransactions,
  getTransactionAccessImpact,
  getTransactionStats,
} from "@/features/payments/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { seedProduct } from "../helpers/seed-payments"

// Garde admin mockée : on isole la logique DB.
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
// Snapshot commun aux transactions de `uid` : l'échéance restaurée se compare
// à la milliseconde.
const AT_90 = new Date(NOW + 90 * DAY)
const AT_10 = new Date(NOW + 10 * DAY)
const uid = createId()
// Accès offert (montant nul) : ne fait pas un acheteur.
const freeUid = createId()
// Deux transactions à montant nul : l'une en litige ouvert, l'autre sans.
const disputeUid = createId()
let pid = ""
let comboPid = ""

// Jeu connu : 4 complétées (CAD old 10000, CAD stripe recent 5000, XAF manual
// recent 300000, CAD manual recent 1), 1 remboursée (exclue stats), 1 pending.
const txCadManualOld = createId()
const txCadStripeRecent = createId()
const txXafManualRecent = createId()
const txRefunded = createId()
const txPending = createId()
const lastTxId = createId()
const txDisputed = createId()
const txUndisputed = createId()

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
    accessExpiresAt: AT_90,
    createdAt: o.createdAt,
    completedAt: o.completedAt,
  })

type Scenario = { userId: string; ids: string[]; at: number[] }

/**
 * Un utilisateur, ses transactions manuelles à montant nul (snapshot à +N
 * jours) et ses lignes `user_access`, posées par le registre lui-même. Montant nul : un scénario ne pèse ni sur les revenus ni sur le
 * nombre d'acheteurs.
 */
const seedScenario = async (
  txs: {
    kind: "combo" | "exam" | "training"
    days: number
    status?: "completed" | "refunded"
  }[],
): Promise<Scenario> => {
  const userId = createId()
  await db.insert(user).values({
    id: userId,
    name: "IT Scénario",
    email: `scenario-${userId}@test.invalid`,
  })
  const rows = txs.map((t) => ({
    id: createId(),
    userId,
    productId: t.kind === "combo" ? comboPid : pid,
    type: "manual" as const,
    status: t.status ?? ("completed" as const),
    amountPaid: 0,
    currency: "CAD" as const,
    accessType:
      t.kind === "training" ? ("training" as const) : ("exam" as const),
    durationDays: t.days,
    accessExpiresAt: new Date(NOW + t.days * DAY),
    createdAt: new Date(NOW - DAY),
    completedAt: new Date(NOW - DAY),
  }))
  await db.insert(transactions).values(rows)
  await db.transaction((t) => rebuildFromTransactions(t, { userId }))
  return {
    userId,
    ids: rows.map((r) => r.id),
    at: rows.map((r) => r.accessExpiresAt.getTime()),
  }
}

// Tout le jeu est posé ici et seuls les tests de reconstruction écrivent, dans
// `user_access` de leur propre scénario : les comptes globaux de
// `getTransactionStats` ne dépendent pas de l'ordre des tests.
let soleFarthest: Scenario
let comboSoleTraining: Scenario
let comboBoth: Scenario
let refundedFarthest: Scenario

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: uid, role: "admin" },
  } as never)

  await db.insert(user).values([
    { id: uid, name: "IT Admin", email: `admin-${uid}@test.invalid` },
    { id: freeUid, name: "IT Offert", email: `offert-${freeUid}@test.invalid` },
    {
      id: disputeUid,
      name: "IT Litige",
      email: `litige-${disputeUid}@test.invalid`,
    },
  ])
  pid = await seedProduct("exam_access", { name: "Exam", durationDays: 90 })
  comboPid = await seedProduct("premium_access", { durationDays: 60 })

  const recent = new Date(NOW - DAY) // < 30 jours
  const old = new Date(NOW - 60 * DAY) // > 30 jours

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

  const zeroAmount = {
    productId: pid,
    status: "completed" as const,
    amountPaid: 0,
    currency: "CAD" as const,
    accessType: "exam" as const,
    durationDays: 90,
    accessExpiresAt: AT_90,
    createdAt: recent,
    completedAt: recent,
  }
  await db.insert(transactions).values([
    {
      ...zeroAmount,
      id: createId(),
      userId: freeUid,
      type: "manual",
      notes: "Accès offert",
    },
    {
      ...zeroAmount,
      id: txDisputed,
      userId: disputeUid,
      type: "stripe",
      stripeDisputeId: "dp_admin",
      disputeStatus: "needs_response",
    },
    { ...zeroAmount, id: txUndisputed, userId: disputeUid, type: "manual" },
  ])

  await db.insert(userAccess).values({
    userId: uid,
    accessType: "exam",
    expiresAt: AT_10,
    lastTransactionId: lastTxId,
  })

  // La transaction à +200 j porte seule l'échéance courante.
  soleFarthest = await seedScenario([
    { kind: "exam", days: 90 },
    { kind: "exam", days: 200 },
  ])
  // exam : un achat simple à +90 j couvre plus loin que le combo (+60 j) ;
  // training : seul le combo le couvre.
  comboSoleTraining = await seedScenario([
    { kind: "combo", days: 60 },
    { kind: "exam", days: 90 },
  ])
  comboBoth = await seedScenario([
    { kind: "combo", days: 200 },
    { kind: "exam", days: 90 },
    { kind: "training", days: 30 },
  ])
  refundedFarthest = await seedScenario([
    { kind: "exam", days: 90 },
    { kind: "exam", days: 200, status: "refunded" },
  ])
})

describe("getTransactionStats (agrégation SQL FILTER + fenêtre 30j)", () => {
  it("agrège revenus et compteurs par devise", async () => {
    const stats = await getTransactionStats()

    expect(stats.revenueByCurrency).toEqual({
      // Total = 10000 + 5000 + 1 (remboursée, pending et montants nuls
      // exclus ou sans poids) ; récent (≤ 30 j) sans la 10000, vieille de 60 j.
      CAD: { total: 15001, recent: 5001 },
      XAF: { total: 300000, recent: 300000 },
    })
  })

  it("compte les acheteurs (montant > 0) et toutes les transactions, tous statuts", async () => {
    const stats = await getTransactionStats()
    // Seul uid a payé : les autres utilisateurs n'ont que des montants nuls.
    expect(stats.buyerCount).toBe(1)
    // uid 6 (remboursée et pending comprises) + offerte 1 + litige 2
    // + scénarios 2 + 2 + 3 + 2.
    expect(stats.transactionCount).toBe(18)
  })
})

describe("getAllTransactions (admin : filtres + keyset)", () => {
  it("renvoie toutes les transactions de l'utilisateur, jointures user/produit peuplées", async () => {
    const page = await getAllTransactions({ userId: uid })
    expect(page.items).toHaveLength(6)
    expect(
      page.items.every((t) => t.user?.email === `admin-${uid}@test.invalid`),
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
    const page = await getAllTransactions({ userId: disputeUid })
    const disputed = page.items.find((t) => t.id === txDisputed)
    const clean = page.items.find((t) => t.id === txUndisputed)

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
    expect(exam).toEqual({
      accessType: "exam",
      willAffectAccess: false,
      currentAccessExpiresAt: AT_10.getTime(),
      restoredExpiresAt: AT_90.getTime(),
    })
  })

  it("willAffectAccess=false pour une transaction non déterminante", async () => {
    const impacts = await getTransactionAccessImpact(txCadManualOld)
    expect(impacts?.some((i) => i.willAffectAccess)).toBe(false)
  })

  it("willAffectAccess=true quand la transaction porte seule l'échéance courante", async () => {
    // Sans la transaction à +200 j, l'accès retomberait à +90 j (le max des
    // transactions restantes).
    const [at90, at200] = soleFarthest.at
    const exam = impactOn(
      await getTransactionAccessImpact(soleFarthest.ids[1]),
      "exam",
    )
    expect(exam).toEqual({
      accessType: "exam",
      willAffectAccess: true,
      currentAccessExpiresAt: at200,
      restoredExpiresAt: at90,
    })
  })

  it("renvoie null pour une transaction inexistante", async () => {
    const impact = await getTransactionAccessImpact(createId())
    expect(impact).toBeNull()
  })
})

// Un combo est enregistré avec `accessType: "exam"` mais couvre les DEUX types :
// l'aperçu doit annoncer, type par type, ce que la reconstruction fera ensuite.
describe("getTransactionAccessImpact — combo", () => {
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
    const { userId, ids, at } = comboSoleTraining
    const [comboId] = ids
    const [, examAt] = at

    const impacts = await getTransactionAccessImpact(comboId)
    expect(impactOn(impacts, "exam")?.willAffectAccess).toBe(false)
    expect(impactOn(impacts, "training")).toMatchObject({
      willAffectAccess: true,
      restoredExpiresAt: null,
    })

    const after = await accessAfterRebuild(userId, comboId)
    expect(after("training")).toBeNull()
    expect(after("exam")).toBe(examAt)
  })

  it("annonce le raccourcissement des deux accès quand le combo porte les deux échéances", async () => {
    const { userId, ids, at } = comboBoth
    const [comboId] = ids
    const [, examAt, trainingAt] = at

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
    const { userId, ids, at } = refundedFarthest
    const [, refundedId] = ids
    const [examAt] = at

    const impacts = await getTransactionAccessImpact(refundedId)
    expect(impacts?.some((i) => i.willAffectAccess)).toBe(false)

    const after = await accessAfterRebuild(userId, refundedId)
    expect(after("exam")).toBe(examAt)
    expect(after("training")).toBeNull()
  })
})
