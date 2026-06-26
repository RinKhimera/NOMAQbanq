import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  exams,
  products,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  getDashboardTrends,
  getFailedPaymentsCount,
  getRecentActivity,
} from "@/features/analytics/dal"
import { getExpiringAccess, getRevenueByDay } from "@/features/payments/dal"
import { getAdminStats } from "@/features/users/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

// `cache()` React → identité (pas de contexte RSC en test node).
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

const A = createId() // admin, créé maintenant
const B = createId() // user, créé maintenant (fenêtre récente)
const C = createId() // user, créé il y a 45j (fenêtre précédente)
const PID = createId()
const E = createId() // examen actif en fenêtre
const TX1 = createId() // CAD 5000 complétée aujourd'hui
const TX2 = createId() // XAF 300000 complétée il y a 2j
const TX3 = createId() // CAD 1000 complétée il y a 45j (fenêtre précédente)
const TX_FAIL = createId() // échouée il y a 1j
const ACC1 = createId() // accès exam B expirant dans 3j
const ACC2 = createId() // accès training C expirant dans 30j (hors fenêtre)

const sumRevenue = (rows: { revenue: number }[]) =>
  rows.reduce((s, r) => s + r.revenue, 0)

// Baselines capturés AVANT seed (la branche éphémère hérite des données de `develop`).
let baseAdmin: Awaited<ReturnType<typeof getAdminStats>>
let baseTrends: Awaited<ReturnType<typeof getDashboardTrends>>
let baseRevenue: Awaited<ReturnType<typeof getRevenueByDay>>
let baseFailed: number

const name = (id: string) => `Adm ${suffix} ${id.slice(0, 4)}`
const email = (id: string) => `${id.slice(0, 6)}-${suffix}@test.invalid`

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: A, role: "admin" },
  } as never)

  baseAdmin = await getAdminStats()
  baseTrends = await getDashboardTrends()
  baseRevenue = await getRevenueByDay()
  baseFailed = await getFailedPaymentsCount()

  const now = Date.now()
  await db.insert(user).values([
    {
      id: A,
      name: name(A),
      email: email(A),
      role: "admin",
      createdAt: new Date(now),
    },
    { id: B, name: name(B), email: email(B), createdAt: new Date(now) },
    {
      id: C,
      name: name(C),
      email: email(C),
      createdAt: new Date(now - 45 * DAY),
    },
  ])
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: `Prod ${suffix}`,
    description: "desc",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
  })
  await db.insert(exams).values({
    id: E,
    title: `Examen ${suffix}`,
    startDate: new Date(now - 2 * DAY),
    endDate: new Date(now + 2 * DAY),
    completionTime: 3600,
    isActive: true,
    createdBy: A,
  })
  await db.insert(examParticipations).values({
    id: createId(),
    examId: E,
    userId: B,
    status: "completed",
    score: 70,
    startedAt: new Date(now - 1000),
    completedAt: new Date(now),
  })

  const tx = (o: {
    id: string
    userId: string
    status: "completed" | "failed"
    currency: "CAD" | "XAF"
    amountPaid: number
    createdAt: number
    completedAt: number | null
  }) => ({
    id: o.id,
    userId: o.userId,
    productId: PID,
    type: "manual" as const,
    status: o.status,
    amountPaid: o.amountPaid,
    currency: o.currency,
    accessType: "exam" as const,
    durationDays: 90,
    accessExpiresAt: new Date(o.createdAt + 90 * DAY),
    createdAt: new Date(o.createdAt),
    completedAt: o.completedAt ? new Date(o.completedAt) : null,
  })
  await db.insert(transactions).values([
    tx({
      id: TX1,
      userId: B,
      status: "completed",
      currency: "CAD",
      amountPaid: 5000,
      createdAt: now,
      completedAt: now,
    }),
    tx({
      id: TX2,
      userId: B,
      status: "completed",
      currency: "XAF",
      amountPaid: 300000,
      createdAt: now - 2 * DAY,
      completedAt: now - 2 * DAY,
    }),
    tx({
      id: TX3,
      userId: C,
      status: "completed",
      currency: "CAD",
      amountPaid: 1000,
      createdAt: now - 45 * DAY,
      completedAt: now - 45 * DAY,
    }),
    tx({
      id: TX_FAIL,
      userId: B,
      status: "failed",
      currency: "CAD",
      amountPaid: 9999,
      createdAt: now - DAY,
      completedAt: null,
    }),
  ])
  await db.insert(userAccess).values([
    {
      id: ACC1,
      userId: B,
      accessType: "exam",
      expiresAt: new Date(now + 3 * DAY),
      lastTransactionId: TX1,
    },
    {
      id: ACC2,
      userId: C,
      accessType: "training",
      expiresAt: new Date(now + 30 * DAY),
      lastTransactionId: TX3,
    },
  ])
})

afterAll(async () => {
  await db.delete(exams).where(eq(exams.createdBy, A)) // cascade participations
  await db.delete(userAccess).where(inArray(userAccess.id, [ACC1, ACC2]))
  await db
    .delete(transactions)
    .where(inArray(transactions.id, [TX1, TX2, TX3, TX_FAIL]))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(inArray(user.id, [A, B, C]))
})

describe("getAdminStats", () => {
  it("compte utilisateurs (par rôle), examens actifs et participations (delta)", async () => {
    const s = await getAdminStats()
    expect(s.totalUsers - baseAdmin.totalUsers).toBe(3)
    expect(s.adminCount - baseAdmin.adminCount).toBe(1)
    expect(s.regularUserCount - baseAdmin.regularUserCount).toBe(2)
    expect(s.totalExams - baseAdmin.totalExams).toBe(1)
    expect(s.activeExams - baseAdmin.activeExams).toBe(1)
    expect(s.totalParticipations - baseAdmin.totalParticipations).toBe(1)
  })
})

describe("getRevenueByDay", () => {
  it("30 jours par devise, somme = transactions complétées de la fenêtre (delta)", async () => {
    const before = new Date().toISOString().slice(0, 10)
    const r = await getRevenueByDay()
    const after = new Date().toISOString().slice(0, 10)
    expect(r.CAD).toHaveLength(30)
    expect(r.XAF).toHaveLength(30)
    // TX1 (CAD aujourd'hui) dans la fenêtre ; TX3 (CAD -45j) hors fenêtre.
    expect(sumRevenue(r.CAD) - sumRevenue(baseRevenue.CAD)).toBe(5000)
    // TX2 (XAF -2j) dans la fenêtre.
    expect(sumRevenue(r.XAF) - sumRevenue(baseRevenue.XAF)).toBe(300000)
    // Dernier bucket = aujourd'hui (UTC). before/after encadrent le `now` interne
    // du DAL → robuste au passage de minuit UTC pendant le test.
    expect([before, after]).toContain(r.CAD.at(-1)?.date)
  })
})

describe("getExpiringAccess", () => {
  it("inclut l'accès expirant dans 7j (avec user), exclut celui à 30j", async () => {
    const list = await getExpiringAccess()
    const mine = list.find((a) => a.id === ACC1)
    expect(mine).toBeDefined()
    expect(mine?.accessType).toBe("exam")
    expect(mine?.daysRemaining).toBe(3)
    expect(mine?.user).toEqual({ name: name(B), email: email(B) })
    expect(list.find((a) => a.id === ACC2)).toBeUndefined()
  })
})

describe("getRecentActivity", () => {
  it("fusionne inscriptions, paiements et examens récents (max 10, triés desc)", async () => {
    const acts = await getRecentActivity()
    expect(acts.length).toBeLessThanOrEqual(10)

    const signup = acts.find(
      (a) => a.type === "user_signup" && a.data.userName === name(A),
    )
    const payment = acts.find(
      (a) => a.type === "payment" && a.data.productName === `Prod ${suffix}`,
    )
    const exam = acts.find(
      (a) =>
        a.type === "exam_completed" && a.data.examTitle === `Examen ${suffix}`,
    )
    expect(signup).toBeDefined()
    expect(payment).toBeDefined()
    expect(exam).toBeDefined()

    // Tri décroissant par timestamp.
    const ts = acts.map((a) => a.timestamp)
    expect(ts).toEqual([...ts].sort((x, y) => y - x))
  })
})

describe("getDashboardTrends", () => {
  it("revenus récents par devise + nouveaux users/participations (delta)", async () => {
    const t = await getDashboardTrends()
    expect(
      t.revenueByCurrency.CAD.recent - baseTrends.revenueByCurrency.CAD.recent,
    ).toBe(5000)
    expect(
      t.revenueByCurrency.XAF.recent - baseTrends.revenueByCurrency.XAF.recent,
    ).toBe(300000)
    // A et B créés maintenant (fenêtre récente) ; C il y a 45j (précédente).
    expect(t.recentUsersCount - baseTrends.recentUsersCount).toBe(2)
    expect(
      t.recentParticipationsCount - baseTrends.recentParticipationsCount,
    ).toBe(1)
    expect(typeof t.usersTrend).toBe("number")
  })
})

describe("getFailedPaymentsCount", () => {
  it("compte les transactions échouées des 7 derniers jours (delta)", async () => {
    expect((await getFailedPaymentsCount()) - baseFailed).toBe(1)
  })
})
