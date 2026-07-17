import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  type ProductForGrant,
  grantManualAccess,
  recomputeAccess,
} from "@/features/payments/lib"
import { createId } from "@/lib/ids"

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)

const pExam: ProductForGrant = {
  id: createId(),
  accessType: "exam",
  durationDays: 30,
  isCombo: false,
}
const pCombo: ProductForGrant = {
  id: createId(),
  accessType: "exam",
  durationDays: 90,
  isCombo: true,
}

const users = {
  first: createId(),
  cumul: createId(),
  combo: createId(),
  comboMax: createId(),
  comboDelete: createId(),
  revoke: createId(),
  recompute: createId(),
  recredit: createId(),
  reminder: createId(),
  expired: createId(),
}
const seedTxId = createId() // FK pour l'accès pré-existant (scénarios cumul/comboMax)

const grant = (userId: string, product: ProductForGrant) =>
  db.transaction((tx) =>
    grantManualAccess(tx, {
      userId,
      product,
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "interac",
      recordedBy: userId, // un id user valide suffit pour la FK recordedBy
    }),
  )

const readExpiry = async (userId: string, accessType: "exam" | "training") => {
  const [row] = await db
    .select({ expiresAt: userAccess.expiresAt })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
  return row?.expiresAt ?? null
}

const daysFromNow = (d: Date | null) =>
  d ? Math.round((d.getTime() - Date.now()) / DAY) : null

beforeAll(async () => {
  await db.insert(user).values(
    Object.entries(users).map(([k, id]) => ({
      id,
      name: `IT ${k}`,
      email: `manual-${k}-${suffix}@test.invalid`,
    })),
  )
  await db.insert(products).values([
    {
      id: pExam.id,
      code: "exam_access",
      name: "Exam",
      description: "d",
      priceCad: 5000,
      durationDays: pExam.durationDays,
      accessType: "exam",
      stripeProductId: `prod_exam_${suffix}`,
      stripePriceId: `price_exam_${suffix}`,
    },
    {
      id: pCombo.id,
      code: "premium_access",
      name: "Combo",
      description: "d",
      priceCad: 9000,
      durationDays: pCombo.durationDays,
      accessType: "exam",
      isCombo: true,
      stripeProductId: `prod_combo_${suffix}`,
      stripePriceId: `price_combo_${suffix}`,
    },
  ])
  // Accès exam pré-existant à +10 jours (scénario cumul) et +200 jours (comboMax).
  await db.insert(transactions).values({
    id: seedTxId,
    userId: users.cumul,
    productId: pExam.id,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 30,
    accessExpiresAt: new Date(Date.now() + 10 * DAY),
    createdAt: new Date(),
    completedAt: new Date(),
  })
  await db.insert(userAccess).values([
    {
      userId: users.cumul,
      accessType: "exam",
      expiresAt: new Date(Date.now() + 10 * DAY),
      lastTransactionId: seedTxId,
    },
    {
      userId: users.comboMax,
      accessType: "exam",
      expiresAt: new Date(Date.now() + 200 * DAY),
      lastTransactionId: seedTxId,
    },
  ])
})

afterAll(async () => {
  const ids = Object.values(users)
  for (const id of ids) {
    await db.delete(userAccess).where(eq(userAccess.userId, id))
    await db.delete(transactions).where(eq(transactions.userId, id))
  }
  await db.delete(products).where(eq(products.id, pExam.id))
  await db.delete(products).where(eq(products.id, pCombo.id))
  for (const id of ids) await db.delete(user).where(eq(user.id, id))
})

describe("grantManualAccess", () => {
  it("premier achat non-combo : expire à now + durée", async () => {
    await grant(users.first, pExam)
    expect(daysFromNow(await readExpiry(users.first, "exam"))).toBe(30)
    expect(await readExpiry(users.first, "training")).toBeNull()
  })

  it("cumul non-combo : ajoute la durée à l'expiration FUTURE (pas un simple GREATEST)", async () => {
    await grant(users.cumul, pExam)
    // 10 (existant futur) + 30 = 40, et surtout PAS max(10, 30) = 30.
    expect(daysFromNow(await readExpiry(users.cumul, "exam"))).toBe(40)
  })

  it("combo : accorde exam ET training à now + durée", async () => {
    await grant(users.combo, pCombo)
    expect(daysFromNow(await readExpiry(users.combo, "exam"))).toBe(90)
    expect(daysFromNow(await readExpiry(users.combo, "training"))).toBe(90)
  })

  it("combo : conserve une expiration déjà plus tardive (max)", async () => {
    await grant(users.comboMax, pCombo)
    // exam : max(200, now+90) = 200 ; training : now+90.
    expect(daysFromNow(await readExpiry(users.comboMax, "exam"))).toBe(200)
    expect(daysFromNow(await readExpiry(users.comboMax, "training"))).toBe(90)
  })
})

const setStatus = (txId: string, status: "completed" | "refunded") =>
  db.update(transactions).set({ status }).where(eq(transactions.id, txId))

const readAccessRow = async (userId: string, type: "exam" | "training") => {
  const [row] = await db
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
      expiryReminderSentAt: userAccess.expiryReminderSentAt,
    })
    .from(userAccess)
    .where(and(eq(userAccess.userId, userId), eq(userAccess.accessType, type)))
    .limit(1)
  return row ?? null
}

const recompute = (userId: string, excludeTransactionId?: string) =>
  db.transaction((tx) => recomputeAccess(tx, { userId, excludeTransactionId }))

describe("recomputeAccess", () => {
  it("refund de la DERNIÈRE transaction : restaure l'expiration précédente (pas de perte du cumul)", async () => {
    const txA = await grant(users.recompute, pExam) // ~ +30 j
    const txB = await grant(users.recompute, pExam) // cumul → ~ +60 j
    expect(daysFromNow(await readExpiry(users.recompute, "exam"))).toBe(60)

    await setStatus(txB, "refunded")
    const result = await recompute(users.recompute)

    expect(result.accessReducedOrRemoved).toBe(true)
    const row = await readAccessRow(users.recompute, "exam")
    expect(daysFromNow(row?.expiresAt ?? null)).toBe(30) // restauré, PAS supprimé
    expect(row?.lastTransactionId).toBe(txA) // re-pointé sur la transaction restante
  })

  it("refund d'une transaction NON dernière : l'accès ne bouge pas", async () => {
    // État hérité du test précédent : txA (+30) est la seule complétée.
    const txC = await grant(users.recompute, pExam) // re-cumule → ~ +60 j
    const before = await readAccessRow(users.recompute, "exam")

    // On recompute alors qu'une refunded traîne en base : no-op.
    const [nonLast] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, users.recompute),
          eq(transactions.status, "refunded"),
        ),
      )
      .limit(1)
    const result = await recompute(users.recompute)
    expect(result.accessReducedOrRemoved).toBe(false)
    const after = await readAccessRow(users.recompute, "exam")
    expect(after?.expiresAt.getTime()).toBe(before?.expiresAt.getTime())
    expect(after?.lastTransactionId).toBe(txC)
    expect(nonLast).toBeDefined() // sanity : il existe bien une refunded en base
  })

  it("refund de la transaction UNIQUE : supprime la ligne d'accès", async () => {
    const txId = await grant(users.revoke, pExam)
    await setStatus(txId, "refunded")
    const result = await recompute(users.revoke)
    expect(result.accessReducedOrRemoved).toBe(true)
    expect(await readExpiry(users.revoke, "exam")).toBeNull()
  })

  it("refunded → completed : RE-CRÉDITE l'accès (bug #111-1)", async () => {
    const txId = await grant(users.recredit, pExam)
    await setStatus(txId, "refunded")
    await recompute(users.recredit)
    expect(await readExpiry(users.recredit, "exam")).toBeNull()

    await setStatus(txId, "completed")
    const result = await recompute(users.recredit)
    expect(result.accessReducedOrRemoved).toBe(false)
    const row = await readAccessRow(users.recredit, "exam")
    expect(daysFromNow(row?.expiresAt ?? null)).toBe(30)
    expect(row?.lastTransactionId).toBe(txId)
  })

  it("re-crédit d'un snapshot PÉRIMÉ : ligne recréée avec l'échéance passée (aucun accès effectif — sémantique assumée)", async () => {
    const txId = await grant(users.expired, pExam)
    await db
      .update(transactions)
      .set({ accessExpiresAt: new Date(Date.now() - 5 * DAY) })
      .where(eq(transactions.id, txId))
    await setStatus(txId, "refunded")
    await recompute(users.expired)
    expect(await readExpiry(users.expired, "exam")).toBeNull()

    // Re-crédit : le snapshot restauré est dans le passé → la ligne existe mais
    // n'ouvre aucun accès (hasAccess vérifie l'échéance). Le toast du modal doit
    // dire « recalculé », jamais « restauré ».
    await setStatus(txId, "completed")
    await recompute(users.expired)
    const row = await readAccessRow(users.expired, "exam")
    expect(daysFromNow(row?.expiresAt ?? null)).toBe(-5)
  })

  it("combo : le recompute couvre exam ET training, et la suppression passe la FK restrict", async () => {
    const txId = await grant(users.comboDelete, pCombo)
    expect(daysFromNow(await readExpiry(users.comboDelete, "exam"))).toBe(90)
    expect(daysFromNow(await readExpiry(users.comboDelete, "training"))).toBe(
      90,
    )

    await db.transaction(async (tx) => {
      const result = await recomputeAccess(tx, {
        userId: users.comboDelete,
        excludeTransactionId: txId,
      })
      expect(result.accessReducedOrRemoved).toBe(true)
      // Ne doit PAS lever de violation de clé étrangère (lastTransactionId restrict).
      await tx.delete(transactions).where(eq(transactions.id, txId))
    })

    expect(await readExpiry(users.comboDelete, "exam")).toBeNull()
    expect(await readExpiry(users.comboDelete, "training")).toBeNull()
  })

  it("est idempotent : deux recomputes successifs produisent le même état", async () => {
    const before = await readAccessRow(users.recompute, "exam")
    const r1 = await recompute(users.recompute)
    const r2 = await recompute(users.recompute)
    expect(r1.accessReducedOrRemoved).toBe(false)
    expect(r2.accessReducedOrRemoved).toBe(false)
    const after = await readAccessRow(users.recompute, "exam")
    expect(after?.expiresAt.getTime()).toBe(before?.expiresAt.getTime())
    expect(after?.lastTransactionId).toBe(before?.lastTransactionId)
  })

  it("expiryReminderSentAt : conservé quand l'accès est RÉDUIT, ré-armé quand il est PROLONGÉ", async () => {
    const txA = await grant(users.reminder, pExam) // +30
    const txB = await grant(users.reminder, pExam) // +60
    const sentAt = new Date()
    await db
      .update(userAccess)
      .set({ expiryReminderSentAt: sentAt })
      .where(eq(userAccess.userId, users.reminder))

    // Réduction (refund de txB) : le rappel déjà envoyé reste marqué.
    await setStatus(txB, "refunded")
    await recompute(users.reminder)
    let row = await readAccessRow(users.reminder, "exam")
    expect(row?.expiryReminderSentAt).not.toBeNull()

    // Prolongation (txB re-complétée) : le rappel est ré-armé (null).
    await setStatus(txB, "completed")
    await recompute(users.reminder)
    row = await readAccessRow(users.reminder, "exam")
    expect(row?.expiryReminderSentAt).toBeNull()
    expect(row?.lastTransactionId).toBe(txB)
    expect(txA).toBeDefined()
  })
})
