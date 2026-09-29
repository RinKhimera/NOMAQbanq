import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  examQuestions,
  exams,
  products,
  questions,
  trainingSessionItems,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  getMyDashboard,
  getMyExamInProgress,
  getMyRecentActivity,
  getMyRecentParticipations,
} from "@/features/analytics/dal"
import { getMyLapsedAccess } from "@/features/payments/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const suffix = createId().slice(0, 8)

const ADMIN_ID = createId()
const STUDENT_ID = createId()
const EMPTY_ID = createId()
const TRAINER_ID = createId()
const REVIEWER_ID = createId()
const users = [ADMIN_ID, STUDENT_ID, EMPTY_ID, TRAINER_ID, REVIEWER_ID]
const LOCKED_QUESTION = createId()
let openExam = ""
const PID = createId()
const examIds: string[] = []

const setSession = (id: string | null, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue(id ? ({ user: { id, role } } as never) : null)

/** Un examen et, si `score` est donné, la participation close de l'étudiant. */
const examWith = async ({
  userId = STUDENT_ID,
  daysAgo,
  score,
  open = false,
}: {
  userId?: string
  daysAgo: number
  score?: number
  open?: boolean
}) => {
  const id = createId()
  examIds.push(id)
  const completedAt = new Date(NOW - daysAgo * DAY)
  await db.insert(exams).values({
    id,
    title: `Examen ${daysAgo} ${suffix}`,
    startDate: new Date(completedAt.getTime() - DAY),
    // Un examen encore ouvert retient le score de ses participations.
    endDate: open
      ? new Date(NOW + DAY)
      : new Date(completedAt.getTime() + 60_000),
    isActive: true,
    createdBy: ADMIN_ID,
    completionTime: 3600,
  })
  if (score !== undefined) {
    await db.insert(examParticipations).values({
      id: createId(),
      examId: id,
      userId,
      status: "completed",
      score,
      startedAt: new Date(completedAt.getTime() - 1000),
      completedAt,
    })
  }
  return id
}

/** Une série ; close (`completedAt`) ou encore en cours. */
const series = async ({
  userId,
  at,
  score = null,
  questionCount = 10,
  status = "completed",
  answered,
}: {
  userId: string
  at: Date
  score?: number | null
  questionCount?: number
  status?: "completed" | "in_progress"
  answered?: string
}) => {
  const id = createId()
  await db.insert(trainingSessions).values({
    id,
    userId,
    status,
    questionCount,
    score,
    startedAt: new Date(at.getTime() - 60_000),
    completedAt: status === "completed" ? at : null,
    expiresAt: new Date(at.getTime() + DAY),
  })
  if (answered) {
    await db.insert(trainingSessionItems).values({
      sessionId: id,
      questionId: answered,
      position: 0,
      selectedAnswer: "A",
      isCorrect: true,
      answeredAt: at,
    })
  }
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: TRAINER_ID, name: "Tr", email: `sdtr-${suffix}@test.invalid` },
    { id: REVIEWER_ID, name: "Rev", email: `sdrev-${suffix}@test.invalid` },
    { id: ADMIN_ID, name: "Adm", email: `sdadm-${suffix}@test.invalid` },
    { id: STUDENT_ID, name: "Stu", email: `sdstu-${suffix}@test.invalid` },
    { id: EMPTY_ID, name: "Empty", email: `sdemp-${suffix}@test.invalid` },
  ])
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: "Exam",
    description: "desc",
    priceCad: 5000,
    durationDays: 30,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
    stripePriceLookupKey: `price_${suffix}`,
  })
  for (const userId of [STUDENT_ID, EMPTY_ID]) {
    const txId = createId()
    await db.insert(transactions).values({
      id: txId,
      userId,
      productId: PID,
      type: "manual",
      status: "completed",
      amountPaid: 5000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: new Date(NOW + 20 * DAY),
    })
    await db.insert(userAccess).values({
      userId,
      accessType: "exam",
      expiresAt: new Date(NOW + 20 * DAY),
      lastTransactionId: txId,
    })
  }

  // Accès Entraînement échu il y a 3 jours.
  const lapsedTx = createId()
  await db.insert(transactions).values({
    id: lapsedTx,
    userId: EMPTY_ID,
    productId: PID,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "training",
    durationDays: 30,
    accessExpiresAt: new Date(NOW - 3 * DAY),
  })
  await db.insert(userAccess).values({
    userId: EMPTY_ID,
    accessType: "training",
    expiresAt: new Date(NOW - 3 * DAY),
    lastTransactionId: lapsedTx,
  })

  await examWith({ daysAgo: 2, score: 80 })
  await examWith({ daysAgo: 3, score: 60 })
  await examWith({ daysAgo: 10, score: 50 })
  await examWith({ daysAgo: 40, score: 30 })
  // Soumise hier, mais l'examen est encore ouvert : score retenu.
  await examWith({ daysAgo: 1, score: 0, open: true })
  await examWith({ userId: REVIEWER_ID, daysAgo: 1, score: 70, open: true })

  await series({ userId: STUDENT_ID, at: new Date(NOW - 2 * DAY) })
  await series({
    userId: STUDENT_ID,
    at: new Date(NOW - 20 * DAY),
    questionCount: 5,
  })
  await series({
    userId: STUDENT_ID,
    at: new Date(NOW),
    status: "in_progress",
    questionCount: 20,
  })

  // Semaines de janvier 2026 (lundis 5, 12, 19, 26), dates fixes.
  await series({
    userId: TRAINER_ID,
    at: new Date("2026-01-06T15:00:00Z"),
    score: 80,
  })
  await series({
    userId: TRAINER_ID,
    at: new Date("2026-01-08T15:00:00Z"),
    score: 60,
  })
  await series({
    userId: TRAINER_ID,
    at: new Date("2026-01-20T15:00:00Z"),
    score: 50,
  })
  // Dimanche 1er février, 23 h 30 à Toronto : déjà lundi en UTC.
  await series({
    userId: TRAINER_ID,
    at: new Date("2026-02-02T04:30:00Z"),
    score: 90,
  })
  await series({
    userId: TRAINER_ID,
    at: new Date("2026-01-13T15:00:00Z"),
    status: "in_progress",
  })
  // Seule série de la semaine du 12, mais une de ses questions est dans un
  // examen ouvert auquel il participe : score retenu.
  await db.insert(questions).values({
    id: LOCKED_QUESTION,
    question: `Q ${suffix}`,
    correctAnswer: "A",
    options: ["A", "B"],
    objectifCmc: "Objectif",
    domain: "Cardiologie",
  })
  openExam = await examWith({
    userId: TRAINER_ID,
    daysAgo: 1,
    open: true,
  })
  await db
    .insert(examQuestions)
    .values({ examId: openExam, questionId: LOCKED_QUESTION, position: 0 })
  await db.insert(examParticipations).values({
    id: createId(),
    examId: openExam,
    userId: TRAINER_ID,
    status: "in_progress",
    startedAt: new Date(NOW - DAY),
  })
  await series({
    userId: TRAINER_ID,
    at: new Date("2026-01-14T15:00:00Z"),
    score: 100,
    answered: LOCKED_QUESTION,
  })
})

afterAll(async () => {
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.userId, users))
  await db.delete(exams).where(inArray(exams.id, examIds))
  await db.delete(questions).where(eq(questions.id, LOCKED_QUESTION))
  await db.delete(userAccess).where(inArray(userAccess.userId, users))
  await db.delete(transactions).where(inArray(transactions.userId, users))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(inArray(user.id, users))
})

describe("getMyDashboard — score moyen des examens blancs", () => {
  it("moyenne des 7 derniers jours, tendance contre les 7 précédents", async () => {
    setSession(STUDENT_ID)
    const d = await getMyDashboard("7")
    // (80 + 60) / 2 ; la participation à l'examen ouvert n'y entre pas.
    expect(d?.exams.averageScore).toBe(70)
    expect(d?.exams.averageTrend).toBe(20) // 70 − 50
  })

  it("moyenne des 30 derniers jours, tendance contre les 30 précédents", async () => {
    setSession(STUDENT_ID)
    const d = await getMyDashboard("30")
    expect(d?.exams.averageScore).toBe(63) // (80 + 60 + 50) / 3
    expect(d?.exams.averageTrend).toBe(33) // 63 − 30
  })

  it("« Tout » : toute l'histoire, sans tendance", async () => {
    setSession(STUDENT_ID)
    const d = await getMyDashboard("tout")
    expect(d?.exams.averageScore).toBe(55)
    expect(d?.exams.averageTrend).toBeNull()
  })

  it("sans participation lisible : moyenne et tendance nulles, jamais 0", async () => {
    setSession(EMPTY_ID)
    const d = await getMyDashboard("30")
    expect(d?.exams.averageScore).toBeNull()
    expect(d?.exams.averageTrend).toBeNull()
  })

  it("un admin lit le score brut de sa participation à un examen ouvert", async () => {
    setSession(REVIEWER_ID, "admin")
    expect((await getMyDashboard("7"))?.exams.averageScore).toBe(70)
    // Jumeau : le même compte lu comme étudiant, score retenu.
    setSession(REVIEWER_ID, "user")
    expect((await getMyDashboard("7"))?.exams.averageScore).toBeNull()
  })

  it("non connecté : null", async () => {
    setSession(null)
    expect(await getMyDashboard("30")).toBeNull()
  })
})

describe("getMyDashboard — chiffres sur « Tout »", () => {
  it("examens complétés et anneau ne dépendent pas de la période", async () => {
    setSession(STUDENT_ID)
    const week = await getMyDashboard("7")
    const all = await getMyDashboard("tout")
    for (const d of [week, all]) {
      // La participation à l'examen ouvert est soumise : elle compte.
      expect(d?.exams.completedCount).toBe(5)
      // Mais son score est retenu : ni notée, ni réussie.
      expect(d?.exams.gradedCount).toBe(4)
      expect(d?.exams.passedCount).toBe(2) // 80 et 60, au seuil
      expect(d?.exams.overallAverage).toBe(55)
    }
    expect(week?.exams.availableCount).toBeGreaterThanOrEqual(5)
  })

  it("sans accès Examens : aucun examen disponible", async () => {
    setSession(ADMIN_ID, "user")
    const d = await getMyDashboard("30")
    expect(d?.exams.availableCount).toBe(0)
    expect(d?.exams.completedCount).toBe(0)
    expect(d?.exams.overallAverage).toBeNull()
  })
})

describe("getMyDashboard — courbe des examens blancs", () => {
  it("scores lisibles de la période, du plus ancien au plus récent", async () => {
    setSession(STUDENT_ID)
    const d = await getMyDashboard("7")
    expect(d?.exams.history.map((h) => h.score)).toEqual([60, 80])
  })

  it("« Tout » reprend toute l'histoire, sans le score retenu", async () => {
    setSession(STUDENT_ID)
    const d = await getMyDashboard("tout")
    expect(d?.exams.history.map((h) => h.score)).toEqual([30, 50, 60, 80])
  })
})

describe("getMyDashboard — entraînement", () => {
  it("séries closes et questions pratiquées de la période, sans la série en cours", async () => {
    setSession(STUDENT_ID)
    const week = await getMyDashboard("7")
    expect(week?.training).toMatchObject({ sessionCount: 1, questionCount: 10 })
    const month = await getMyDashboard("30")
    expect(month?.training).toMatchObject({
      sessionCount: 2,
      questionCount: 15,
    })
  })

  it("courbe hebdomadaire : moyenne par semaine civile de l'Est, aucun point sans série lisible", async () => {
    setSession(TRAINER_ID)
    const d = await getMyDashboard("tout")
    expect(d?.training.weekly).toEqual([
      { weekStart: "2026-01-05", averageScore: 70, sessionCount: 2 },
      { weekStart: "2026-01-19", averageScore: 50, sessionCount: 1 },
      { weekStart: "2026-01-26", averageScore: 90, sessionCount: 1 },
    ])
    // La série au score retenu reste une série faite.
    expect(d?.training).toMatchObject({ sessionCount: 5, questionCount: 50 })
  })

  it("courbe vide quand la période ne contient aucune série", async () => {
    setSession(TRAINER_ID)
    const d = await getMyDashboard("30")
    expect(d?.training.weekly).toEqual([])
    expect(d?.training.sessionCount).toBe(0)
  })
})

describe("getMyDashboard — historique", () => {
  it("vrai dès une participation soumise ou une série close, faux sinon", async () => {
    setSession(STUDENT_ID)
    expect((await getMyDashboard("7"))?.hasHistory).toBe(true)
    setSession(TRAINER_ID)
    expect((await getMyDashboard("7"))?.hasHistory).toBe(true)
    setSession(EMPTY_ID)
    expect((await getMyDashboard("7"))?.hasHistory).toBe(false)
  })
})

describe("getMyRecentParticipations", () => {
  it("cinq dernières participations soumises, score retenu à null", async () => {
    setSession(STUDENT_ID)
    const rows = await getMyRecentParticipations()
    expect(rows.map((r) => r.score)).toEqual([null, 80, 60, 50, 30])
    expect(rows[1]).toMatchObject({ questionCount: 0 })
  })

  it("une participation en cours n'en est pas une", async () => {
    setSession(TRAINER_ID)
    expect(await getMyRecentParticipations()).toEqual([])
  })
})

describe("getMyRecentActivity", () => {
  it("achats, participations et séries closes, du plus récent au plus ancien", async () => {
    setSession(STUDENT_ID)
    const items = await getMyRecentActivity()
    expect(items.length).toBeLessThanOrEqual(6)
    expect(items[0]).toMatchObject({ kind: "purchase" })
    expect(items[1]).toMatchObject({ kind: "exam", score: null })
    const times = items.map((i) => i.at)
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it("la série en cours n'y figure pas, la série au score retenu y est à null", async () => {
    setSession(TRAINER_ID)
    const items = await getMyRecentActivity()
    const series = items.filter((i) => i.kind === "series")
    expect(series.map((i) => i.score)).toEqual([90, 50, null, 60, 80])
    expect(items.some((i) => i.kind === "exam")).toBe(false)
  })
})

describe("getMyExamInProgress", () => {
  it("la participation ouverte, avec sa progression et son chrono", async () => {
    setSession(TRAINER_ID)
    const p = await getMyExamInProgress()
    expect(p).toMatchObject({
      examId: openExam,
      answeredCount: 0,
      questionCount: 1,
    })
    expect(p?.timing.budgetSeconds).toBe(3600)
  })

  it("aucune sans participation ouverte", async () => {
    setSession(STUDENT_ID)
    expect(await getMyExamInProgress()).toBeNull()
  })
})

describe("getMyLapsedAccess", () => {
  it("date d'échéance d'un accès échu, null pour un accès actif ou absent", async () => {
    setSession(EMPTY_ID)
    const lapsed = await getMyLapsedAccess()
    expect(lapsed.exam).toBeNull()
    expect(lapsed.training).toBeCloseTo(NOW - 3 * DAY, -3)
  })
})
