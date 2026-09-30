import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  account,
  examParticipations,
  exams,
  products,
  questionBookmarks,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  type UsersHeadline,
  getUserFile,
  getUsersForExport,
  getUsersHeadline,
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
const NOW = Date.now()
const suffix = createId().slice(0, 8) // jeton unique → isole mes users via `search`
const pid = createId()

// Exam actif (20 j), training expirant (3 j), exam expiré (−10 j), jamais
// d'accès, suspendu sans accès, admin sans accès.
const uActiveExam = createId()
const uExpiringTrain = createId()
const uExpired = createId()
const uNever = createId()
const uBanned = createId()
const uAdmin = createId()
const mine = [uActiveExam, uExpiringTrain, uExpired, uNever, uBanned, uAdmin]
const txActiveExam = createId()
const txExpiringTrain = createId()
const txExpired = createId()
const examId = createId()

// Jeu de pagination, isolé par son propre jeton.
const pageSuffix = createId().slice(0, 8)
const pageUsers = Array.from({ length: 22 }, (_, k) => ({
  id: createId(),
  name: `Page ${String(k).padStart(2, "0")} ${pageSuffix}`,
  email: `page-${k}-${pageSuffix}@test.invalid`,
}))

// Jeu dédié aux bornes de dates. Les `createdAt` encadrent la journée du
// 3 juillet 2026 en heure de l'Est (EDT, UTC-4).
const dateSuffix = createId().slice(0, 8)
const dateUsers = [
  { id: createId(), label: "veille-23h30", createdAt: "2026-07-03T03:30:00Z" },
  { id: createId(), label: "jour-00h05", createdAt: "2026-07-03T04:05:00Z" },
  { id: createId(), label: "jour-23h59", createdAt: "2026-07-04T03:59:00Z" },
  {
    id: createId(),
    label: "lendemain-00h30",
    createdAt: "2026-07-04T04:30:00Z",
  },
]
const dateUserId = (label: string) =>
  dateUsers.find((u) => u.label === label)!.id
const allIds = [
  ...mine,
  ...pageUsers.map((u) => u.id),
  ...dateUsers.map((u) => u.id),
]

let baseline: UsersHeadline

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: uAdmin, role: "admin" },
  } as never)
  baseline = await getUsersHeadline()

  await db.insert(user).values([
    {
      id: uActiveExam,
      name: `Zeta ${suffix}`,
      username: `zeta_${suffix}`,
      email: `active-${suffix}@test.invalid`,
      lastLoginAt: new Date(NOW - DAY),
      notifyMarketing: false,
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
      // Remplie d'office au déploiement : un compte importé n'en montre rien.
      lastLoginAt: new Date(NOW - 2 * DAY),
    },
    {
      id: uBanned,
      name: `Kappa ${suffix}`,
      email: `banned-${suffix}@test.invalid`,
      banned: true,
    },
    {
      id: uAdmin,
      name: `Omega ${suffix}`,
      email: `admin-${suffix}@test.invalid`,
      role: "admin",
    },
    ...pageUsers,
    ...dateUsers.map((u) => ({
      id: u.id,
      name: `Date ${u.label} ${dateSuffix}`,
      email: `${u.label}-${dateSuffix}@test.invalid`,
      createdAt: new Date(u.createdAt),
    })),
  ])

  // Seuls ces comptes se sont connectés depuis la migration.
  await db.insert(account).values([
    {
      id: createId(),
      accountId: uActiveExam,
      providerId: "credential",
      userId: uActiveExam,
    },
    {
      id: createId(),
      accountId: `google-${suffix}`,
      providerId: "google",
      userId: uActiveExam,
    },
    {
      id: createId(),
      accountId: uAdmin,
      providerId: "credential",
      userId: uAdmin,
    },
  ])

  await db.insert(products).values({
    id: pid,
    code: "exam_access",
    name: `Exam ${suffix}`,
    description: "d",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
    stripePriceLookupKey: `price_${suffix}`,
  })

  const mkTx = (
    id: string,
    userId: string,
    accessType: "exam" | "training",
    currency: "CAD" | "XAF" = "CAD",
  ) =>
    db.insert(transactions).values({
      id,
      userId,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: currency === "XAF" ? 2_500_000 : 1000,
      currency,
      paymentMethod: "interac",
      accessType,
      durationDays: 90,
      accessExpiresAt: new Date(NOW + 90 * DAY),
      createdAt: new Date(NOW - DAY),
      completedAt: new Date(NOW - DAY),
    })
  await mkTx(txActiveExam, uActiveExam, "exam")
  await mkTx(txExpiringTrain, uExpiringTrain, "training")
  await mkTx(txExpired, uExpired, "exam", "XAF")

  await db.insert(userAccess).values([
    {
      userId: uActiveExam,
      accessType: "exam",
      expiresAt: new Date(NOW + 20 * DAY),
      lastTransactionId: txActiveExam,
    },
    {
      userId: uExpiringTrain,
      accessType: "training",
      expiresAt: new Date(NOW + 3 * DAY),
      lastTransactionId: txExpiringTrain,
    },
    {
      userId: uExpired,
      accessType: "exam",
      expiresAt: new Date(NOW - 10 * DAY),
      lastTransactionId: txExpired,
    },
  ])

  // Examen encore ouvert : l'admin lit le score brut, retenu pour l'étudiant.
  await db.insert(exams).values({
    id: examId,
    title: `Examen ouvert ${suffix}`,
    startDate: new Date(NOW - 5 * DAY),
    endDate: new Date(NOW + 5 * DAY),
    completionTime: 3600,
    createdBy: uAdmin,
  })
  await db.insert(examParticipations).values({
    examId,
    userId: uActiveExam,
    score: 73,
    status: "completed",
    startedAt: new Date(NOW - 2 * DAY),
    completedAt: new Date(NOW - 2 * DAY + 3600_000),
  })
  await db.insert(trainingSessions).values([
    {
      userId: uActiveExam,
      status: "completed",
      mode: "tutor",
      questionCount: 10,
      score: 71,
      startedAt: new Date(NOW - 3 * DAY),
      completedAt: new Date(NOW - 3 * DAY),
      expiresAt: new Date(NOW),
    },
    {
      userId: uActiveExam,
      status: "completed",
      mode: "test",
      questionCount: 10,
      score: 60,
      startedAt: new Date(NOW - 4 * DAY),
      completedAt: new Date(NOW - 4 * DAY),
      expiresAt: new Date(NOW),
    },
  ])
})

afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, [examId]))
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.userId, allIds))
  await db
    .delete(questionBookmarks)
    .where(inArray(questionBookmarks.userId, allIds))
  await db.delete(userAccess).where(inArray(userAccess.userId, allIds))
  await db.delete(transactions).where(inArray(transactions.userId, allIds))
  await db.delete(products).where(inArray(products.id, [pid]))
  await db.delete(user).where(inArray(user.id, allIds))
})

const ids = (items: { id: string }[]) => new Set(items.map((u) => u.id))

describe("getUsersWithFilters — pages de 20 avec total", () => {
  it("20 lignes par page par défaut, total filtré, page suivante par offset", async () => {
    const p1 = await getUsersWithFilters({
      search: pageSuffix,
      sortBy: "name",
      sortOrder: "asc",
    })
    expect(p1.items).toHaveLength(20)
    expect(p1.total).toBe(22)
    expect(p1.items[0]?.id).toBe(pageUsers[0].id)

    const p2 = await getUsersWithFilters({
      search: pageSuffix,
      sortBy: "name",
      sortOrder: "asc",
      offset: 20,
    })
    expect(p2.items.map((u) => u.id)).toEqual(
      pageUsers.slice(20).map((u) => u.id),
    )
  })
})

describe("getUsersWithFilters — segments d'accès", () => {
  it("compteurs de chaque segment ; un admin n'entre dans aucun segment d'accès", async () => {
    const page = await getUsersWithFilters({ search: suffix })
    expect(page.segmentCounts).toEqual({
      all: 6,
      active: 2,
      expiring: 1,
      expired: 1,
      never: 2,
    })
  })

  it("Accès actif inclut « expire bientôt »", async () => {
    const page = await getUsersWithFilters({
      search: suffix,
      segment: "active",
    })
    expect(ids(page.items)).toEqual(new Set([uActiveExam, uExpiringTrain]))
  })

  it("Expire bientôt : 7 jours", async () => {
    const page = await getUsersWithFilters({
      search: suffix,
      segment: "expiring",
    })
    expect(ids(page.items)).toEqual(new Set([uExpiringTrain]))
  })

  it("Expiré : une échéance passée, aucune active ; Jamais eu : sans admin", async () => {
    const expired = await getUsersWithFilters({
      search: suffix,
      segment: "expired",
    })
    expect(ids(expired.items)).toEqual(new Set([uExpired]))
    const never = await getUsersWithFilters({
      search: suffix,
      segment: "never",
    })
    expect(ids(never.items)).toEqual(new Set([uNever, uBanned]))
  })

  it("expiration lue même passée : « Expiré le » distinct de « Jamais eu »", async () => {
    const page = await getUsersWithFilters({ search: suffix })
    const expired = page.items.find((u) => u.id === uExpired)
    const never = page.items.find((u) => u.id === uNever)
    expect(expired?.examExpiresAt).toBeLessThan(NOW)
    expect(never?.examExpiresAt).toBeNull()
  })
})

describe("getUsersWithFilters — filtres", () => {
  it("Suspendus", async () => {
    const page = await getUsersWithFilters({ search: suffix, suspended: true })
    expect(ids(page.items)).toEqual(new Set([uBanned]))
  })

  it("rôle administrateur", async () => {
    const page = await getUsersWithFilters({ search: suffix, role: "admin" })
    expect(ids(page.items)).toEqual(new Set([uAdmin]))
  })

  it("recherche sur le nom d'utilisateur", async () => {
    const page = await getUsersWithFilters({ search: `zeta_${suffix}` })
    expect(ids(page.items)).toEqual(new Set([uActiveExam]))
  })

  it("dernière connexion : « — » pour un compte importé, jamais la valeur remplie d'office", async () => {
    const page = await getUsersWithFilters({
      search: suffix,
      sortBy: "lastLogin",
      sortOrder: "desc",
    })
    const active = page.items.find((u) => u.id === uActiveExam)
    const imported = page.items.find((u) => u.id === uNever)
    expect(active?.lastLoginAt).toBe(NOW - DAY)
    expect(imported?.lastLoginAt).toBeNull()
    // Connexions connues d'abord ; les « — » en fin de liste.
    expect(page.items[0]?.id).toBe(uActiveExam)
  })
})

describe("getUsersWithFilters — plage de dates", () => {
  it("une plage « J → J » couvre la journée civile entière", async () => {
    const page = await getUsersWithFilters({
      search: dateSuffix,
      dateFrom: "2026-07-03",
      dateTo: "2026-07-03",
    })
    expect(ids(page.items)).toEqual(
      new Set([dateUserId("jour-00h05"), dateUserId("jour-23h59")]),
    )
    expect(page.total).toBe(2)
  })

  it("la veille à 23:30 tombe hors plage, le lendemain à 00:30 dedans", async () => {
    const found = ids(
      (
        await getUsersWithFilters({
          search: dateSuffix,
          dateFrom: "2026-07-03",
        })
      ).items,
    )
    expect(found.has(dateUserId("veille-23h30"))).toBe(false)
    expect(found.has(dateUserId("lendemain-00h30"))).toBe(true)
  })
})

describe("getUsersForExport — selon les filtres courants", () => {
  it("n'exporte que le segment demandé, avec les échéances d'accès", async () => {
    const rows = await getUsersForExport({ search: suffix, segment: "active" })
    expect(rows.map((r) => r.email).sort()).toEqual([
      `active-${suffix}@test.invalid`,
      `expiring-${suffix}@test.invalid`,
    ])
    const active = rows.find((r) => r.email.startsWith("active-"))
    expect(active?.examExpiresAt).toBeGreaterThan(NOW)
    expect(active?.trainingExpiresAt).toBeNull()
    expect(active?.banned).toBe(false)
  })
})

describe("getUsersHeadline", () => {
  it("comptes et nouveaux sur 30 jours (écart à la ligne de base)", async () => {
    const after = await getUsersHeadline()
    expect(after.total - baseline.total).toBe(allIds.length)
    // Le jeu « plage de dates » est daté de juillet 2026.
    expect(after.newLast30Days - baseline.newLast30Days).toBe(
      mine.length + pageUsers.length,
    )
  })
})

describe("getUserFile — fiche", () => {
  it("accès : « Expiré le » distinct de « Jamais eu »", async () => {
    const expired = await getUserFile(uExpired)
    expect(expired?.access.exam).toBeLessThan(NOW)
    expect(expired?.access.training).toBeNull()
  })

  it("compte importé : aucune ligne account, ni méthode ni dernière connexion", async () => {
    const file = await getUserFile(uNever)
    expect(file?.user.imported).toBe(true)
    expect(file?.user.loginMethods).toEqual([])
    expect(file?.user.lastLoginAt).toBeNull()
  })

  it("méthodes de connexion lues dans account.provider_id", async () => {
    const file = await getUserFile(uActiveExam)
    expect(file?.user.imported).toBe(false)
    expect(file?.user.loginMethods).toEqual(["credential", "google"])
  })

  it("score brut pour l'admin sur un examen encore ouvert, avec sa fermeture", async () => {
    const file = await getUserFile(uActiveExam)
    const [p] = file!.activity.participations
    expect(p).toMatchObject({
      examTitle: `Examen ouvert ${suffix}`,
      status: "completed",
      score: 73,
    })
    expect(p.examEndsAt).toBeGreaterThan(NOW)
    expect(file?.activity.participationCount).toBe(1)
  })

  it("séries en résumé : nombre, moyenne au plancher, part tuteur", async () => {
    const file = await getUserFile(uActiveExam)
    expect(file?.activity.series).toMatchObject({
      count: 2,
      average: 65,
      tutorShare: 50,
    })
    expect(file?.activity.lastActivity?.kind).toBe("participation")
  })

  it("résumé des paiements : CAD et XAF séparés, dernier paiement", async () => {
    const xaf = await getUserFile(uExpired)
    expect(xaf?.payments).toMatchObject({
      count: 1,
      totalCad: 0,
      totalXaf: 2_500_000,
    })
    expect(xaf?.payments?.last.status).toBe("completed")
    const none = await getUserFile(uNever)
    expect(none?.payments).toBeNull()
  })

  it("préférences de communication", async () => {
    const file = await getUserFile(uActiveExam)
    expect(file?.communications.prefs).toEqual({
      examResults: true,
      accessExpiry: true,
      marketing: false,
    })
  })

  it("null pour un utilisateur inexistant", async () => {
    expect(await getUserFile(createId())).toBeNull()
  })
})
