import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  type UsersStatsView,
  getUserPanelData,
  getUsersStats,
  getUsersWithFilters,
} from "@/features/users/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8) // jeton unique → isole mes users via `search`
const pid = createId()

// 5 users : exam actif (20j), training expirant (3j), exam expiré (-10j), aucun accès, admin sans accès.
const uActiveExam = createId()
const uExpiringTrain = createId()
const uExpired = createId()
const uNever = createId()
const uAdmin = createId()
const txActiveExam = createId()
const txExpiringTrain = createId()
const txExpired = createId()

let baseline: UsersStatsView

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: uAdmin, role: "admin" },
  } as never)

  baseline = await getUsersStats()

  await db.insert(user).values([
    {
      id: uActiveExam,
      name: `Zeta ${suffix}`,
      email: `active-${suffix}@test.invalid`,
    },
    {
      id: uExpiringTrain,
      name: `Alpha ${suffix}`,
      email: `expiring-${suffix}@test.invalid`,
    },
    {
      id: uExpired,
      name: `Mu ${suffix}`,
      email: `expired-${suffix}@test.invalid`,
    },
    {
      id: uNever,
      name: `Beta ${suffix}`,
      email: `never-${suffix}@test.invalid`,
    },
    {
      id: uAdmin,
      name: `Omega ${suffix}`,
      email: `admin-${suffix}@test.invalid`,
      role: "admin",
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
  })

  const now = Date.now()
  const mkTx = (id: string, userId: string, accessType: "exam" | "training") =>
    db.insert(transactions).values({
      id,
      userId,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType,
      durationDays: 90,
      accessExpiresAt: new Date(now + 90 * DAY),
      createdAt: new Date(now),
      completedAt: new Date(now),
    })

  await mkTx(txActiveExam, uActiveExam, "exam")
  await mkTx(txExpiringTrain, uExpiringTrain, "training")
  await mkTx(txExpired, uExpired, "exam")

  await db.insert(userAccess).values([
    {
      userId: uActiveExam,
      accessType: "exam",
      expiresAt: new Date(now + 20 * DAY),
      lastTransactionId: txActiveExam,
    },
    {
      userId: uExpiringTrain,
      accessType: "training",
      expiresAt: new Date(now + 3 * DAY),
      lastTransactionId: txExpiringTrain,
    },
    {
      userId: uExpired,
      accessType: "exam",
      expiresAt: new Date(now - 10 * DAY),
      lastTransactionId: txExpired,
    },
  ])
})

afterAll(async () => {
  const ids = [uActiveExam, uExpiringTrain, uExpired, uNever, uAdmin]
  for (const id of ids) {
    await db.delete(userAccess).where(eq(userAccess.userId, id))
    await db.delete(transactions).where(eq(transactions.userId, id))
  }
  await db.delete(products).where(eq(products.id, pid))
  for (const id of ids) await db.delete(user).where(eq(user.id, id))
})

describe("getUsersWithFilters (filtres SQL)", () => {
  it("recherche par suffixe → mes 5 users, accès enrichis", async () => {
    const page = await getUsersWithFilters({ search: suffix, limit: 50 })
    expect(page.items).toHaveLength(5)
    const active = page.items.find((u) => u.id === uActiveExam)
    expect(active?.examAccess?.daysRemaining).toBeGreaterThan(15)
    expect(active?.trainingAccess).toBeNull()
  })

  it("accessStatus=active → exam actif + training expirant", async () => {
    const page = await getUsersWithFilters({
      search: suffix,
      accessStatus: "active",
    })
    const ids = page.items.map((u) => u.id)
    expect(new Set(ids)).toEqual(new Set([uActiveExam, uExpiringTrain]))
  })

  it("accessStatus=expiring → seulement le training à 3j", async () => {
    const page = await getUsersWithFilters({
      search: suffix,
      accessStatus: "expiring",
    })
    expect(page.items.map((u) => u.id)).toEqual([uExpiringTrain])
  })

  it("accessStatus=expired → a une ligne d'accès mais aucune active", async () => {
    const page = await getUsersWithFilters({
      search: suffix,
      accessStatus: "expired",
    })
    expect(page.items.map((u) => u.id)).toEqual([uExpired])
  })

  it("accessStatus=never → les users sans aucune ligne d'accès", async () => {
    const page = await getUsersWithFilters({
      search: suffix,
      accessStatus: "never",
    })
    expect(new Set(page.items.map((u) => u.id))).toEqual(
      new Set([uNever, uAdmin]),
    )
  })

  it("filtre role=admin", async () => {
    const page = await getUsersWithFilters({ search: suffix, role: "admin" })
    expect(page.items.map((u) => u.id)).toEqual([uAdmin])
  })

  it("tri par nom asc insensible à la casse + pagination par offset", async () => {
    const p1 = await getUsersWithFilters({
      search: suffix,
      sortBy: "name",
      sortOrder: "asc",
      limit: 2,
    })
    expect(p1.items).toHaveLength(2)
    expect(p1.nextOffset).toBe(2)
    // Alpha, Beta en tête (ordre alpha).
    expect(p1.items[0]?.id).toBe(uExpiringTrain) // "Alpha"
    expect(p1.items[1]?.id).toBe(uNever) // "Beta"

    const p3 = await getUsersWithFilters({
      search: suffix,
      sortBy: "name",
      sortOrder: "asc",
      limit: 2,
      offset: 4,
    })
    expect(p3.items).toHaveLength(1)
    expect(p3.nextOffset).toBeNull()
  })
})

describe("getUsersStats (agrégats, delta vs baseline)", () => {
  it("compteurs users + accès actifs/expirants", async () => {
    const after = await getUsersStats()
    expect(after.totalUsers - baseline.totalUsers).toBe(5)
    expect(after.newThisMonth - baseline.newThisMonth).toBe(5)
    expect(after.activeExamAccess - baseline.activeExamAccess).toBe(1)
    expect(after.activeTrainingAccess - baseline.activeTrainingAccess).toBe(1)
    expect(after.examExpiringCount - baseline.examExpiringCount).toBe(0)
    expect(after.trainingExpiringCount - baseline.trainingExpiringCount).toBe(1)
    expect(
      after.revenueByCurrency.CAD.recent -
        baseline.revenueByCurrency.CAD.recent,
    ).toBe(3000)
  })
})

describe("getUserPanelData", () => {
  it("user + accès isActive + transactions récentes + total", async () => {
    const data = await getUserPanelData(uActiveExam)
    expect(data?.user.email).toBe(`active-${suffix}@test.invalid`)
    expect(data?.examAccess?.isActive).toBe(true)
    expect(data?.trainingAccess).toBeNull()
    expect(data?.totalTransactionCount).toBe(1)
    expect(data?.recentTransactions[0]?.product?.name).toBe("Exam")
  })

  it("null pour un utilisateur inexistant", async () => {
    expect(await getUserPanelData(createId())).toBeNull()
  })
})
