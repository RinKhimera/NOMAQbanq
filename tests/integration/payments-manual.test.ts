import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  grantManualAccess,
  revokeAccessIfLast,
  type ProductForGrant,
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

describe("revokeAccessIfLast", () => {
  it("révoque si la transaction est la dernière, sinon non", async () => {
    const txA = await grant(users.revoke, pExam)
    const txB = await grant(users.revoke, pExam) // devient lastTransactionId

    // txA n'est plus la dernière → pas de révocation.
    const notLast = await db.transaction((tx) =>
      revokeAccessIfLast(tx, { id: txA, userId: users.revoke }),
    )
    expect(notLast).toBe(false)
    expect(await readExpiry(users.revoke, "exam")).not.toBeNull()

    // txB est la dernière → révocation.
    const last = await db.transaction((tx) =>
      revokeAccessIfLast(tx, { id: txB, userId: users.revoke }),
    )
    expect(last).toBe(true)
    expect(await readExpiry(users.revoke, "exam")).toBeNull()
  })

  it("combo : révoque exam ET training, puis la transaction peut être supprimée (régression FK restrict)", async () => {
    // Un combo pose lastTransactionId=txId sur exam ET training. Révoquer un seul
    // type laisserait l'autre ligne référencer la tx → DELETE bloqué (FK restrict).
    const txId = await grant(users.comboDelete, pCombo)
    expect(daysFromNow(await readExpiry(users.comboDelete, "exam"))).toBe(90)
    expect(daysFromNow(await readExpiry(users.comboDelete, "training"))).toBe(90)

    await db.transaction(async (tx) => {
      const revoked = await revokeAccessIfLast(tx, {
        id: txId,
        userId: users.comboDelete,
      })
      expect(revoked).toBe(true)
      // Ne doit PAS lever de violation de clé étrangère.
      await tx.delete(transactions).where(eq(transactions.id, txId))
    })

    expect(await readExpiry(users.comboDelete, "exam")).toBeNull()
    expect(await readExpiry(users.comboDelete, "training")).toBeNull()
  })
})
