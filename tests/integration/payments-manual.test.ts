import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  type ProductForGrant,
  grantManualAccess,
} from "@/features/payments/lib"
import { createId } from "@/lib/ids"

// Ce fichier couvre ce qui appartient en propre à `grantManualAccess` : la
// transaction manuelle qu'il insère et le mapping vers `applyGrant`. La règle de
// cumul/combo/re-arm est prouvée sur le module (tests/integration/access-ledger).

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-09-18T12:00:00.000Z")
const at = (days: number) => new Date(NOW.getTime() + days * DAY)
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

const users = { first: createId(), combo: createId(), admin: createId() }

const grant = (userId: string, product: ProductForGrant) =>
  db.transaction((tx) =>
    grantManualAccess(tx, {
      userId,
      product,
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "interac",
      notes: "reçu papier",
      recordedBy: users.admin,
      now: NOW,
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
      stripePriceLookupKey: `price_exam_${suffix}`,
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
      stripePriceLookupKey: `price_combo_${suffix}`,
    },
  ])
})

afterAll(async () => {
  const ids = Object.values(users)
  await db.delete(userAccess).where(inArray(userAccess.userId, ids))
  await db.delete(transactions).where(inArray(transactions.userId, ids))
  await db.delete(products).where(inArray(products.id, [pExam.id, pCombo.id]))
  await db.delete(user).where(inArray(user.id, ids))
})

describe("grantManualAccess", () => {
  it("insère une transaction manuelle complétée portant le snapshot du cumul, et ouvre l'accès", async () => {
    const transactionId = await grant(users.first, pExam)

    const [row] = await db
      .select({
        type: transactions.type,
        status: transactions.status,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        paymentMethod: transactions.paymentMethod,
        notes: transactions.notes,
        recordedBy: transactions.recordedBy,
        accessType: transactions.accessType,
        durationDays: transactions.durationDays,
        accessExpiresAt: transactions.accessExpiresAt,
        completedAt: transactions.completedAt,
      })
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)
    expect(row).toEqual({
      type: "manual",
      status: "completed",
      amountPaid: 5000,
      currency: "CAD",
      paymentMethod: "interac",
      notes: "reçu papier",
      recordedBy: users.admin,
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: at(30),
      completedAt: NOW,
    })
    expect(await readExpiry(users.first, "exam")).toEqual(at(30))
    expect(await readExpiry(users.first, "training")).toBeNull()
  })

  it("produit combo : ouvre exam ET training sur la même transaction", async () => {
    await grant(users.combo, pCombo)
    expect(await readExpiry(users.combo, "exam")).toEqual(at(90))
    expect(await readExpiry(users.combo, "training")).toEqual(at(90))
  })

  it("utilisateur inconnu → USER_NOT_FOUND avant toute écriture", async () => {
    const ghost = createId()
    await expect(grant(ghost, pExam)).rejects.toThrow("USER_NOT_FOUND")
    const rows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.userId, ghost))
    expect(rows).toEqual([])
  })
})
