import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  products,
  questions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  getMyAvailableExams,
  getMyDashboardStats,
  getMyRecentExams,
  getMyScoreHistory,
} from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const ADMIN_ID = createId()
const STUDENT_ID = createId()
const NOACCESS_ID = createId()
const PID = createId()

// Examens seedés directement (dates/isActive maîtrisés). Pas besoin de questions :
// les fonctions testées n'agrègent que exams + examParticipations.
const examA = createId() // actif, en fenêtre, complété 80
const examB = createId() // actif, en fenêtre, complété 40
const examC = createId() // actif, en fenêtre, sans participation
const examInactive = createId() // inactif
const examPast = createId() // actif mais fenêtre passée
const examFuture = createId() // actif mais fenêtre future
const allExamIds = [examA, examB, examC, examInactive, examPast, examFuture]

const setSession = (id: string | null, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue(id ? ({ user: { id, role } } as never) : null)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")
const asNoAccess = () => setSession(NOACCESS_ID, "user")
const partA = createId()
const partB = createId()
const withheldQuestionId = createId()

beforeAll(async () => {
  await db.insert(user).values([
    { id: ADMIN_ID, name: "Dash admin", email: `dadm-${suffix}@test.invalid` },
    { id: STUDENT_ID, name: "Dash stu", email: `dstu-${suffix}@test.invalid` },
    { id: NOACCESS_ID, name: "Dash noa", email: `dnoa-${suffix}@test.invalid` },
  ])
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: "Exam",
    description: "desc",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
    stripePriceLookupKey: `price_${suffix}`,
  })
  const txId = createId()
  await db.insert(transactions).values({
    id: txId,
    userId: STUDENT_ID,
    productId: PID,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(Date.now() + 90 * DAY),
  })
  await db.insert(userAccess).values({
    userId: STUDENT_ID,
    accessType: "exam",
    expiresAt: new Date(Date.now() + 10 * DAY),
    lastTransactionId: txId,
  })

  const now = Date.now()
  const win = (start: number, end: number, isActive = true) => ({
    startDate: new Date(start),
    endDate: new Date(end),
    isActive,
    createdBy: ADMIN_ID,
    completionTime: 3600,
  })
  await db.insert(exams).values([
    { id: examA, title: `A ${suffix}`, ...win(now - 2 * DAY, now + 2 * DAY) },
    { id: examB, title: `B ${suffix}`, ...win(now - 2 * DAY, now + 2 * DAY) },
    { id: examC, title: `C ${suffix}`, ...win(now - 2 * DAY, now + 2 * DAY) },
    {
      id: examInactive,
      title: `I ${suffix}`,
      ...win(now - 2 * DAY, now + 2 * DAY, false),
    },
    {
      id: examPast,
      title: `P ${suffix}`,
      ...win(now - 5 * DAY, now - 1 * DAY),
    },
    {
      id: examFuture,
      title: `F ${suffix}`,
      ...win(now + 1 * DAY, now + 5 * DAY),
    },
  ])

  await db.insert(examParticipations).values([
    {
      id: partA,
      examId: examA,
      userId: STUDENT_ID,
      status: "completed",
      score: 80,
      startedAt: new Date(now - 2 * DAY - 1000),
      completedAt: new Date(now - 2 * DAY),
    },
    {
      id: partB,
      examId: examB,
      userId: STUDENT_ID,
      status: "completed",
      score: 40,
      startedAt: new Date(now - DAY - 1000),
      completedAt: new Date(now - DAY),
    },
  ])
})

afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, allExamIds)) // cascade participations
  await db.delete(userAccess).where(eq(userAccess.userId, STUDENT_ID))
  await db.delete(transactions).where(eq(transactions.userId, STUDENT_ID))
  await db.delete(products).where(eq(products.id, PID))
  await db
    .delete(user)
    .where(inArray(user.id, [ADMIN_ID, STUDENT_ID, NOACCESS_ID]))
})

describe("getMyDashboardStats", () => {
  it("étudiant avec accès : 2 complétés, moyenne 60, examens dispo > 0", async () => {
    asStudent()
    const s = await getMyDashboardStats()
    expect(s?.completedExamsCount).toBe(2)
    expect(s?.averageScore).toBe(60) // round((80 + 40) / 2)
    expect(s?.availableExamsCount).toBeGreaterThanOrEqual(5) // tous les actifs
  })

  it("sans accès : availableExamsCount = 0, aucun complété", async () => {
    asNoAccess()
    const s = await getMyDashboardStats()
    expect(s).toEqual({
      availableExamsCount: 0,
      completedExamsCount: 0,
      averageScore: null,
    })
  })

  it("non connecté : null", async () => {
    setSession(null)
    expect(await getMyDashboardStats()).toBeNull()
  })
})

describe("getMyRecentExams", () => {
  it("complétés d'abord (date desc), enrichis du score", async () => {
    asStudent()
    const recent = await getMyRecentExams()
    // examB complété le plus récemment → en tête, puis examA.
    expect(recent[0]).toMatchObject({ id: examB, isCompleted: true, score: 40 })
    expect(recent[1]).toMatchObject({ id: examA, isCompleted: true, score: 80 })
    // Les non complétés suivent.
    expect(recent.slice(2).every((e) => !e.isCompleted)).toBe(true)
  })

  it("sans accès : liste vide", async () => {
    asNoAccess()
    expect(await getMyRecentExams()).toEqual([])
  })
})

describe("getMyScoreHistory", () => {
  it("examens complétés en ordre chronologique ASC, avec titre", async () => {
    asStudent()
    const hist = await getMyScoreHistory()
    const mine = hist.filter((h) => [examA, examB].includes(h.examId))
    expect(mine.map((h) => h.examId)).toEqual([examA, examB]) // A (J-2) avant B (J-1)
    expect(mine[0]).toMatchObject({ score: 80, examTitle: `A ${suffix}` })
    expect(mine[1]).toMatchObject({ score: 40, examTitle: `B ${suffix}` })
  })
})

describe("getMyAvailableExams", () => {
  it("étudiant : actifs DANS la fenêtre uniquement", async () => {
    asStudent()
    const ids = (await getMyAvailableExams()).map((e) => e.id)
    expect(ids).toEqual(expect.arrayContaining([examA, examB, examC]))
    expect(ids).not.toContain(examInactive)
    expect(ids).not.toContain(examPast)
    expect(ids).not.toContain(examFuture)
  })

  it("admin : voit aussi les actifs en fenêtre", async () => {
    asAdmin()
    const ids = (await getMyAvailableExams()).map((e) => e.id)
    expect(ids).toEqual(expect.arrayContaining([examA, examB, examC]))
  })

  it("sans accès : liste vide", async () => {
    asNoAccess()
    expect(await getMyAvailableExams()).toEqual([])
  })
})

// Score retenu : tant que l'examen d'une participation est OUVERT, une réponse
// enregistrée retient son score (`scoreWithheldFor`) — un score lisible
// pendant la fenêtre donnerait les clés (100 % = toutes les bonnes options).
// Les describes précédents lisent examA sans réponse enregistrée : lisible.
describe("score retenu (examen encore ouvert)", () => {
  beforeAll(async () => {
    await db.insert(questions).values({
      id: withheldQuestionId,
      question: `Q retenue ${suffix} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj ${suffix}`,
      domain: `DASH-${suffix}`,
    })
    await db.insert(examQuestions).values({
      examId: examA,
      questionId: withheldQuestionId,
      position: 0,
    })
    await db.insert(examAnswers).values({
      id: createId(),
      participationId: partA,
      questionId: withheldQuestionId,
      selectedAnswer: "A",
      isCorrect: true,
    })
  })

  afterAll(async () => {
    await db
      .delete(examAnswers)
      .where(eq(examAnswers.questionId, withheldQuestionId))
    await db
      .delete(examQuestions)
      .where(eq(examQuestions.questionId, withheldQuestionId))
    await db.delete(questions).where(eq(questions.id, withheldQuestionId))
  })

  it("getMyRecentExams / getMyScoreHistory : examA retenu (null), examB lisible", async () => {
    asStudent()
    const recent = await getMyRecentExams()
    expect(recent.find((e) => e.id === examA)).toMatchObject({
      isCompleted: true,
      score: null,
    })
    expect(recent.find((e) => e.id === examB)?.score).toBe(40)

    const hist = await getMyScoreHistory()
    expect(hist.find((h) => h.examId === examA)?.score).toBeNull()
    expect(hist.find((h) => h.examId === examB)?.score).toBe(40)
  })

  it("getMyDashboardStats : la participation retenue compte comme complétée mais sort de la moyenne", async () => {
    asStudent()
    const s = await getMyDashboardStats()
    expect(s?.completedExamsCount).toBe(2)
    expect(s?.averageScore).toBe(40) // 80 retenu, reste 40
  })

  // Tout retenu : la moyenne n'est pas « 0 % » (faux résultat) mais `null`.
  describe("tout retenu", () => {
    beforeAll(async () => {
      await db.insert(examQuestions).values({
        examId: examB,
        questionId: withheldQuestionId,
        position: 0,
      })
      await db.insert(examAnswers).values({
        id: createId(),
        participationId: partB,
        questionId: withheldQuestionId,
        selectedAnswer: "A",
        isCorrect: true,
      })
    })

    it("getMyDashboardStats : complétés comptés, moyenne null, jamais 0", async () => {
      asStudent()
      const s = await getMyDashboardStats()
      expect(s?.completedExamsCount).toBe(2)
      expect(s?.averageScore).toBeNull()
    })

    it("getMyScoreHistory : les deux points retenus", async () => {
      asStudent()
      const hist = await getMyScoreHistory()
      expect(hist.find((h) => h.examId === examA)?.score).toBeNull()
      expect(hist.find((h) => h.examId === examB)?.score).toBeNull()
    })
  })
})
