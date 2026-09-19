import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  applyGrant,
  rebuildFromTransactions,
} from "@/features/payments/access-ledger"
import { createId } from "@/lib/ids"

type AccessType = "exam" | "training"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-09-18T12:00:00.000Z")
const SENT = new Date("2026-09-01T00:00:00.000Z")
const suffix = createId().slice(0, 8)

const at = (days: number) => new Date(NOW.getTime() + days * DAY)

const P = {
  exam: { id: createId(), accessType: "exam" as const, isCombo: false },
  training: { id: createId(), accessType: "training" as const, isCombo: false },
  combo: { id: createId(), accessType: "exam" as const, isCombo: true },
}

const seededUsers: string[] = []
const newUser = async () => {
  const id = createId()
  await db.insert(user).values({
    id,
    name: `Ledger ${id.slice(0, 6)}`,
    email: `ledger-${id.slice(0, 6)}-${suffix}@test.invalid`,
  })
  seededUsers.push(id)
  return id
}

const seedTransaction = async (o: {
  userId: string
  product: (typeof P)[keyof typeof P]
  durationDays: number
  status?: "pending" | "completed" | "refunded"
  accessExpiresAt?: Date
}) => {
  const id = createId()
  await db.insert(transactions).values({
    id,
    userId: o.userId,
    productId: o.product.id,
    type: "manual",
    status: o.status ?? "completed",
    amountPaid: 5000,
    currency: "CAD",
    paymentMethod: "interac",
    accessType: o.product.accessType,
    durationDays: o.durationDays,
    accessExpiresAt: o.accessExpiresAt ?? NOW,
    createdAt: NOW,
    completedAt: NOW,
  })
  return id
}

const seedAccess = async (
  userId: string,
  accessType: AccessType,
  days: number,
  lastTransactionId: string,
) =>
  db.insert(userAccess).values({
    userId,
    accessType,
    expiresAt: at(days),
    lastTransactionId,
    expiryReminderSentAt: SENT,
  })

const readAccess = async (userId: string, accessType: AccessType) => {
  const [row] = await db
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
      expiryReminderSentAt: userAccess.expiryReminderSentAt,
    })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
  return row ?? null
}

const readSnapshot = (transactionId: string) =>
  db
    .select({ accessExpiresAt: transactions.accessExpiresAt })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1)
    .then((r) => r[0]?.accessExpiresAt ?? null)

const grant = (o: {
  userId: string
  product: (typeof P)[keyof typeof P]
  durationDays: number
  transactionId: string
  now?: Date
}) =>
  db.transaction((tx) =>
    applyGrant(tx, {
      userId: o.userId,
      product: o.product,
      durationDays: o.durationDays,
      transactionId: o.transactionId,
      now: o.now ?? NOW,
    }),
  )

const rebuild = (userId: string, excludeTransactionId?: string) =>
  db.transaction((tx) =>
    rebuildFromTransactions(tx, { userId, excludeTransactionId }),
  )

const setStatus = (id: string, status: "completed" | "refunded") =>
  db.update(transactions).set({ status }).where(eq(transactions.id, id))

beforeAll(async () => {
  await db.insert(products).values(
    (
      [
        ["exam", "exam_access", P.exam],
        ["training", "training_access", P.training],
        ["combo", "premium_access", P.combo],
      ] as const
    ).map(([key, code, p]) => ({
      id: p.id,
      code,
      name: `Ledger ${key}`,
      description: "d",
      priceCad: 5000,
      durationDays: 30,
      accessType: p.accessType,
      isCombo: p.isCombo,
      stripeProductId: `prod_ledger_${key}_${suffix}`,
      stripePriceId: `price_ledger_${key}_${suffix}`,
      stripePriceLookupKey: `price_ledger_${key}_${suffix}`,
    })),
  )
})

afterAll(async () => {
  await db.delete(userAccess).where(inArray(userAccess.userId, seededUsers))
  await db.delete(transactions).where(inArray(transactions.userId, seededUsers))
  await db.delete(products).where(
    inArray(
      products.id,
      Object.values(P).map((p) => p.id),
    ),
  )
  await db.delete(user).where(inArray(user.id, seededUsers))
})

// ---------------------------------------------------------------------------
// applyGrant — cumul, combo, re-arm, snapshot : la règle, prouvée une fois.
// ---------------------------------------------------------------------------

type Expected = {
  /** Jours après NOW ; absent = aucune ligne d'accès pour ce type. */
  days: number
  /** true = `expiryReminderSentAt` remis à null (l'expiration a avancé). */
  rearmed: boolean
}

const grantCases: Array<{
  name: string
  product: (typeof P)[keyof typeof P]
  durationDays: number
  existing: Partial<Record<AccessType, number>>
  expected: Partial<Record<AccessType, Expected>>
  /** Snapshot porté par la transaction (jours après NOW). */
  snapshotDays: number
}> = [
  {
    name: "premier achat non-combo : now + durée, un seul type",
    product: P.exam,
    durationDays: 30,
    existing: {},
    expected: { exam: { days: 30, rearmed: true } },
    snapshotDays: 30,
  },
  {
    name: "cumul non-combo : durée ajoutée à l'expiration FUTURE (pas max)",
    product: P.exam,
    durationDays: 30,
    existing: { exam: 10 },
    expected: { exam: { days: 40, rearmed: true } },
    snapshotDays: 40,
  },
  {
    name: "non-combo sur accès EXPIRÉ : repart de now, rappel ré-armé",
    product: P.exam,
    durationDays: 30,
    existing: { exam: -5 },
    expected: { exam: { days: 30, rearmed: true } },
    snapshotDays: 30,
  },
  {
    name: "non-combo training : ne touche pas l'accès exam",
    product: P.training,
    durationDays: 30,
    existing: { exam: 10 },
    expected: {
      exam: { days: 10, rearmed: false },
      training: { days: 30, rearmed: true },
    },
    snapshotDays: 30,
  },
  {
    name: "combo : fenêtre fraîche now + durée sur exam ET training",
    product: P.combo,
    durationDays: 90,
    existing: {},
    expected: {
      exam: { days: 90, rearmed: true },
      training: { days: 90, rearmed: true },
    },
    snapshotDays: 90,
  },
  {
    name: "combo par-dessus un accès plus long : max conservé, pas de re-arm ; l'autre type est frais",
    product: P.combo,
    durationDays: 90,
    existing: { exam: 200 },
    expected: {
      exam: { days: 200, rearmed: false },
      training: { days: 90, rearmed: true },
    },
    snapshotDays: 90,
  },
  {
    name: "combo par-dessus un accès plus court : ne CUMULE pas, pose now + durée",
    product: P.combo,
    durationDays: 90,
    existing: { exam: 10, training: 10 },
    expected: {
      exam: { days: 90, rearmed: true },
      training: { days: 90, rearmed: true },
    },
    snapshotDays: 90,
  },
  {
    name: "expiration inchangée (égalité) : pas de re-arm",
    product: P.combo,
    durationDays: 90,
    existing: { exam: 90 },
    expected: {
      exam: { days: 90, rearmed: false },
      training: { days: 90, rearmed: true },
    },
    snapshotDays: 90,
  },
]

describe("applyGrant", () => {
  it.each(grantCases)("$name", async (c) => {
    const userId = await newUser()
    const seedTx = await seedTransaction({
      userId,
      product: P.exam,
      durationDays: 1,
    })
    for (const [type, days] of Object.entries(c.existing)) {
      await seedAccess(userId, type as AccessType, days, seedTx)
    }
    const transactionId = await seedTransaction({
      userId,
      product: c.product,
      durationDays: c.durationDays,
    })

    const granted = await grant({
      userId,
      product: c.product,
      durationDays: c.durationDays,
      transactionId,
    })

    const grantedTypes: AccessType[] = c.product.isCombo
      ? ["exam", "training"]
      : [c.product.accessType]
    expect(
      granted
        .map((g) => ({
          accessType: g.accessType,
          days: (g.expiresAt.getTime() - NOW.getTime()) / DAY,
        }))
        .sort((a, b) => a.accessType.localeCompare(b.accessType)),
    ).toEqual(
      grantedTypes
        .map((accessType) => ({
          accessType,
          days: c.expected[accessType]!.days,
        }))
        .sort((a, b) => a.accessType.localeCompare(b.accessType)),
    )

    const rows = {
      exam: await readAccess(userId, "exam"),
      training: await readAccess(userId, "training"),
    }
    const describeRow = (row: (typeof rows)["exam"]) =>
      row && {
        days: (row.expiresAt.getTime() - NOW.getTime()) / DAY,
        rearmed: row.expiryReminderSentAt === null,
        lastTransactionId: row.lastTransactionId,
      }
    expect({
      exam: describeRow(rows.exam),
      training: describeRow(rows.training),
    }).toEqual({
      exam: c.expected.exam
        ? {
            ...c.expected.exam,
            lastTransactionId: grantedTypes.includes("exam")
              ? transactionId
              : seedTx,
          }
        : null,
      training: c.expected.training
        ? {
            ...c.expected.training,
            lastTransactionId: grantedTypes.includes("training")
              ? transactionId
              : seedTx,
          }
        : null,
    })

    expect((await readSnapshot(transactionId))?.getTime()).toBe(
      at(c.snapshotDays).getTime(),
    )
  })

  it("utilisateur inconnu → USER_NOT_FOUND", async () => {
    await expect(
      grant({
        userId: createId(),
        product: P.exam,
        durationDays: 30,
        transactionId: createId(),
      }),
    ).rejects.toThrow("USER_NOT_FOUND")
  })

  it("transaction absente ou non complétée → TRANSACTION_NOT_COMPLETED, aucun accès", async () => {
    const userId = await newUser()
    const pending = await seedTransaction({
      userId,
      product: P.exam,
      durationDays: 30,
      status: "pending",
    })
    await expect(
      grant({
        userId,
        product: P.exam,
        durationDays: 30,
        transactionId: pending,
      }),
    ).rejects.toThrow("TRANSACTION_NOT_COMPLETED")
    await expect(
      grant({
        userId,
        product: P.exam,
        durationDays: 30,
        transactionId: createId(),
      }),
    ).rejects.toThrow("TRANSACTION_NOT_COMPLETED")
    expect(await readAccess(userId, "exam")).toBeNull()
  })

  it("deux octrois concurrents du même type → cumul exact (verrou user FOR UPDATE)", async () => {
    const userId = await newUser()
    const [txA, txB] = await Promise.all([
      seedTransaction({ userId, product: P.exam, durationDays: 90 }),
      seedTransaction({ userId, product: P.exam, durationDays: 90 }),
    ])

    await Promise.all([
      grant({ userId, product: P.exam, durationDays: 90, transactionId: txA }),
      grant({ userId, product: P.exam, durationDays: 90, transactionId: txB }),
    ])

    const rows = await db
      .select({ expiresAt: userAccess.expiresAt })
      .from(userAccess)
      .where(eq(userAccess.userId, userId))
    expect(rows).toHaveLength(1)
    // 90 + 90 ; retombe à 90 si le verrou saute (les deux lisent « aucun accès »).
    expect(rows[0].expiresAt.getTime()).toBe(at(180).getTime())
  })
})

// ---------------------------------------------------------------------------
// rebuildFromTransactions — les transactions `completed` sont la source de vérité.
// ---------------------------------------------------------------------------

describe("rebuildFromTransactions", () => {
  const grantExam = async (userId: string, durationDays: number) => {
    const transactionId = await seedTransaction({
      userId,
      product: P.exam,
      durationDays,
    })
    await grant({ userId, product: P.exam, durationDays, transactionId })
    return transactionId
  }

  it("retrait de la DERNIÈRE transaction : restaure le snapshot précédent, re-pointe", async () => {
    const userId = await newUser()
    const txA = await grantExam(userId, 30)
    const txB = await grantExam(userId, 30) // cumul → +60
    expect((await readAccess(userId, "exam"))?.expiresAt.getTime()).toBe(
      at(60).getTime(),
    )

    await setStatus(txB, "refunded")
    const result = await rebuild(userId)

    expect(result).toEqual({ accessReducedOrRemoved: true })
    const row = await readAccess(userId, "exam")
    expect(row?.expiresAt.getTime()).toBe(at(30).getTime())
    expect(row?.lastTransactionId).toBe(txA)
  })

  it("retrait d'une transaction NON dernière : l'accès ne bouge pas", async () => {
    const userId = await newUser()
    const txA = await grantExam(userId, 30)
    const txB = await grantExam(userId, 30)
    await setStatus(txA, "refunded")

    const result = await rebuild(userId)

    expect(result).toEqual({ accessReducedOrRemoved: false })
    const row = await readAccess(userId, "exam")
    expect(row?.expiresAt.getTime()).toBe(at(60).getTime())
    expect(row?.lastTransactionId).toBe(txB)
  })

  it("retrait de la transaction UNIQUE : supprime la ligne d'accès", async () => {
    const userId = await newUser()
    const txId = await grantExam(userId, 30)
    await setStatus(txId, "refunded")

    const result = await rebuild(userId)

    expect(result).toEqual({ accessReducedOrRemoved: true })
    expect(await readAccess(userId, "exam")).toBeNull()
  })

  it("refunded → completed : re-crédite l'accès depuis le snapshot", async () => {
    const userId = await newUser()
    const txId = await grantExam(userId, 30)
    await setStatus(txId, "refunded")
    await rebuild(userId)
    expect(await readAccess(userId, "exam")).toBeNull()

    await setStatus(txId, "completed")
    const result = await rebuild(userId)

    expect(result).toEqual({ accessReducedOrRemoved: false })
    const row = await readAccess(userId, "exam")
    expect(row?.expiresAt.getTime()).toBe(at(30).getTime())
    expect(row?.lastTransactionId).toBe(txId)
  })

  it("re-crédit d'un snapshot PÉRIMÉ : ligne recréée avec l'échéance passée (aucun accès effectif)", async () => {
    const userId = await newUser()
    const txId = await grantExam(userId, 30)
    await db
      .update(transactions)
      .set({ accessExpiresAt: at(-5) })
      .where(eq(transactions.id, txId))
    await setStatus(txId, "refunded")
    await rebuild(userId)
    expect(await readAccess(userId, "exam")).toBeNull()

    await setStatus(txId, "completed")
    await rebuild(userId)

    expect((await readAccess(userId, "exam"))?.expiresAt.getTime()).toBe(
      at(-5).getTime(),
    )
  })

  it("combo exclu : couvre exam ET training, et le DELETE passe la FK restrict", async () => {
    const userId = await newUser()
    const txId = await seedTransaction({
      userId,
      product: P.combo,
      durationDays: 90,
    })
    await grant({
      userId,
      product: P.combo,
      durationDays: 90,
      transactionId: txId,
    })

    await db.transaction(async (tx) => {
      const result = await rebuildFromTransactions(tx, {
        userId,
        excludeTransactionId: txId,
      })
      expect(result).toEqual({ accessReducedOrRemoved: true })
      await tx.delete(transactions).where(eq(transactions.id, txId))
    })

    expect(await readAccess(userId, "exam")).toBeNull()
    expect(await readAccess(userId, "training")).toBeNull()
  })

  it("un combo couvre l'autre type : le retrait d'un exam retombe sur le combo", async () => {
    const userId = await newUser()
    const comboId = await seedTransaction({
      userId,
      product: P.combo,
      durationDays: 30,
    })
    await grant({
      userId,
      product: P.combo,
      durationDays: 30,
      transactionId: comboId,
    })
    const examId = await grantExam(userId, 30) // cumul → +60
    await setStatus(examId, "refunded")

    const result = await rebuild(userId)

    expect(result).toEqual({ accessReducedOrRemoved: true })
    const exam = await readAccess(userId, "exam")
    expect(exam?.expiresAt.getTime()).toBe(at(30).getTime())
    expect(exam?.lastTransactionId).toBe(comboId)
    expect((await readAccess(userId, "training"))?.lastTransactionId).toBe(
      comboId,
    )
  })

  it("idempotent : deux reconstructions successives produisent le même état", async () => {
    const userId = await newUser()
    await grantExam(userId, 30)
    const before = await readAccess(userId, "exam")

    const r1 = await rebuild(userId)
    const r2 = await rebuild(userId)

    expect(r1).toEqual({ accessReducedOrRemoved: false })
    expect(r2).toEqual({ accessReducedOrRemoved: false })
    expect(await readAccess(userId, "exam")).toEqual(before)
  })

  it("rappel de fin d'accès : conservé quand l'accès est RÉDUIT, ré-armé quand il est PROLONGÉ", async () => {
    const userId = await newUser()
    await grantExam(userId, 30)
    const txB = await grantExam(userId, 30)
    await db
      .update(userAccess)
      .set({ expiryReminderSentAt: SENT })
      .where(eq(userAccess.userId, userId))

    await setStatus(txB, "refunded")
    await rebuild(userId)
    expect((await readAccess(userId, "exam"))?.expiryReminderSentAt).toEqual(
      SENT,
    )

    await setStatus(txB, "completed")
    await rebuild(userId)
    const row = await readAccess(userId, "exam")
    expect(row?.expiryReminderSentAt).toBeNull()
    expect(row?.lastTransactionId).toBe(txB)
  })

  it("aucune transaction et aucun accès : no-op", async () => {
    const userId = await newUser()
    expect(await rebuild(userId)).toEqual({ accessReducedOrRemoved: false })
    expect(await readAccess(userId, "exam")).toBeNull()
  })

  it("utilisateur inconnu → USER_NOT_FOUND", async () => {
    await expect(rebuild(createId())).rejects.toThrow("USER_NOT_FOUND")
  })
})
