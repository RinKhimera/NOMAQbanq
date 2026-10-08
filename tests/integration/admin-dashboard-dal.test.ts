import { inArray } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  exams,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import { getDashboardTrends, getRecentActivity } from "@/features/analytics/dal"
import { getExpiringAccess, getRevenueByDay } from "@/features/payments/dal"
import { getAdminStats } from "@/features/users/dal"
import {
  shiftCalendarDay,
  startOfNextAppZoneDay,
  toAppZoneCalendarDay,
} from "@/lib/app-zone"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { seedProduct } from "../helpers/seed-payments"

// Garde admin mockée : on isole la logique DB.
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000

const A = createId() // admin, créé maintenant
const B = createId() // user, créé maintenant (fenêtre récente)
const C = createId() // user, créé il y a 45j (fenêtre précédente)
let PID: string
const E = createId() // examen actif en fenêtre
const TX1 = createId() // CAD 5000 complétée aujourd'hui
const TX2 = createId() // XAF 300000 complétée il y a 2j
const TX3 = createId() // CAD 1000 complétée il y a 45j (fenêtre précédente)
const TX_FAIL = createId() // échouée il y a 1j
const TX_SOIR = createId() // CAD complétée hier à 21:00 heure de l'Est
const ACC1 = createId() // accès exam B expirant dans 3j
const ACC2 = createId() // accès training C expirant dans 30j (hors fenêtre)

const sumRevenue = (rows: { revenue: number }[]) =>
  rows.reduce((s, r) => s + r.revenue, 0)

// 21:00 hier, heure de l'Est : le même instant tombe le lendemain en UTC. Jour
// et instant sont figés au chargement du module pour que le seed et l'assertion
// désignent le même bucket même si minuit passe pendant la suite.
const SOIR_CAD = 4200
const JOUR_SOIR = shiftCalendarDay(toAppZoneCalendarDay(Date.now()), -1)
const INSTANT_SOIR =
  startOfNextAppZoneDay(JOUR_SOIR).getTime() - 3 * 60 * 60 * 1000

const name = (id: string) => `Adm ${id.slice(0, 4)}`
const email = (id: string) => `${id}@test.invalid`

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: A, role: "admin" },
  } as never)

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
  PID = await seedProduct("exam_access", { name: "Produit examens" })
  await db.insert(exams).values({
    id: E,
    title: "Examen tableau de bord",
    startDate: new Date(now - 2 * DAY),
    endDate: new Date(now + 2 * DAY),
    completionTime: 3600,
    isActive: true,
    createdBy: A,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
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
    tx({
      id: TX_SOIR,
      userId: B,
      status: "completed",
      currency: "CAD",
      amountPaid: SOIR_CAD,
      createdAt: INSTANT_SOIR,
      completedAt: INSTANT_SOIR,
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

describe("getAdminStats", () => {
  it("compte utilisateurs (par rôle), examens actifs et participations", async () => {
    const s = await getAdminStats()
    expect(s.totalUsers).toBe(3)
    expect(s.adminCount).toBe(1)
    expect(s.regularUserCount).toBe(2)
    expect(s.totalExams).toBe(1)
    expect(s.activeExams).toBe(1)
    expect(s.totalParticipations).toBe(1)
  })
})

describe("getRevenueByDay", () => {
  it("30 jours par devise, somme = transactions complétées de la fenêtre", async () => {
    const before = toAppZoneCalendarDay(Date.now())
    const r = await getRevenueByDay()
    const after = toAppZoneCalendarDay(Date.now())
    expect(r.CAD).toHaveLength(30)
    expect(r.XAF).toHaveLength(30)
    // TX1 (CAD aujourd'hui) et TX_SOIR (CAD hier soir) dans la fenêtre ;
    // TX3 (CAD -45j) hors fenêtre.
    expect(sumRevenue(r.CAD)).toBe(5000 + SOIR_CAD)
    // TX2 (XAF -2j) dans la fenêtre.
    expect(sumRevenue(r.XAF)).toBe(300000)
    // Dernier bucket = aujourd'hui (heure de l'Est). before/after encadrent le
    // `now` interne du DAL → robuste au passage de minuit pendant le test.
    expect([before, after]).toContain(r.CAD.at(-1)?.date)
  })

  it("un encaissement de 21:00 compte pour sa soirée, pas pour le lendemain", async () => {
    const r = await getRevenueByDay()
    const jour = (rows: { date: string; revenue: number }[], d: string) =>
      rows.find((row) => row.date === d)?.revenue ?? 0

    // Bucketé en UTC, cet encaissement partirait sur le jour suivant : sa
    // propre soirée serait à 0.
    expect(jour(r.CAD, JOUR_SOIR)).toBe(SOIR_CAD)
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
    // Plus de candidats que les plafonds : 9 inscriptions (5 retenues), 6
    // paiements complétés (5 retenus) et 1 examen → 11 activités, coupées à 10.
    // Les inscriptions ajoutées sont les plus récentes : sans la limite à 5,
    // elles occuperaient davantage de places.
    const now = Date.now()
    const extraUsers = Array.from({ length: 6 }, (_, i) => ({
      id: createId(),
      name: `Extra ${i}`,
      email: `extra-${i}@test.invalid`,
      createdAt: new Date(now + (i + 1) * 60_000),
    }))
    const extraTxIds = [createId(), createId()]
    await db.insert(user).values(extraUsers)
    await db.insert(transactions).values(
      extraTxIds.map((id, i) => ({
        id,
        userId: B,
        productId: PID,
        type: "manual" as const,
        status: "completed" as const,
        amountPaid: 100,
        currency: "CAD" as const,
        accessType: "exam" as const,
        durationDays: 90,
        accessExpiresAt: new Date(now + 90 * DAY),
        createdAt: new Date(now - (i + 3) * DAY),
        completedAt: new Date(now - (i + 3) * DAY),
      })),
    )

    try {
      const acts = await getRecentActivity()
      expect(acts).toHaveLength(10)
      expect(acts.filter((a) => a.type === "user_signup")).toHaveLength(5)

      const signup = acts.find(
        (a) => a.type === "user_signup" && a.data.userName === "Extra 5",
      )
      const payment = acts.find(
        (a) => a.type === "payment" && a.data.productName === "Produit examens",
      )
      const exam = acts.find(
        (a) =>
          a.type === "exam_completed" &&
          a.data.examTitle === "Examen tableau de bord",
      )
      expect(signup).toBeDefined()
      expect(payment).toBeDefined()
      expect(exam).toBeDefined()

      // Tri décroissant par timestamp.
      const ts = acts.map((a) => a.timestamp)
      expect(ts).toEqual([...ts].sort((x, y) => y - x))
    } finally {
      await db.delete(transactions).where(inArray(transactions.id, extraTxIds))
      await db.delete(user).where(
        inArray(
          user.id,
          extraUsers.map((u) => u.id),
        ),
      )
    }
  })
})

describe("getDashboardTrends", () => {
  it("revenus récents par devise + nouveaux users/participations", async () => {
    const t = await getDashboardTrends()
    expect(t.revenueByCurrency.CAD.recent).toBe(5000 + SOIR_CAD)
    expect(t.revenueByCurrency.XAF.recent).toBe(300000)
    // A et B créés maintenant (fenêtre récente) ; C il y a 45j (précédente).
    expect(t.recentUsersCount).toBe(2)
    expect(t.recentParticipationsCount).toBe(1)
    expect(t.usersTrend).toBe(100)
  })
})
