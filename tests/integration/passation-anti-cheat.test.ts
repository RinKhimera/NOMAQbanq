/**
 * Tests d'intégration : saveExamAnswer + saveExamFlag + finalizeExam
 * Anti-triche, flagging, et flux complet de passation.
 */
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  exams,
  products,
  questions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  finalizeExam,
  pauseExam,
  resumeExam,
  saveExamAnswer,
  saveExamFlag,
  startExam,
} from "@/features/exams/actions"
import { createExam } from "@/features/exams/actions"
import { getExamSession } from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const ADMIN_ID = createId()
const STUDENT_ID = createId()
const PID = createId()
const qIds = Array.from({ length: 6 }, () => createId())

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")

let examId: string
let pauseExamId: string

beforeAll(async () => {
  await db.insert(user).values([
    { id: ADMIN_ID, name: "AC admin", email: `ac-adm-${suffix}@test.invalid` },
    {
      id: STUDENT_ID,
      name: "AC student",
      email: `ac-stu-${suffix}@test.invalid`,
    },
  ])
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: "Exam",
    description: "desc",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: `prod_ac_${suffix}`,
    stripePriceId: `price_ac_${suffix}`,
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
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `AC Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj AC ${suffix}`,
      domain: `AC-${suffix}`,
    })),
  )

  asAdmin()
  const now = Date.now()
  const r1 = await createExam({
    title: `AC Exam ${suffix}`,
    startDate: now - 3600_000,
    endDate: now + 3600_000,
    questionIds: qIds,
    enablePause: false,
  })
  if (!r1.success) throw new Error(r1.error)
  examId = r1.examId

  const r2 = await createExam({
    title: `AC Pause Exam ${suffix}`,
    startDate: now - 3600_000,
    endDate: now + 3600_000,
    questionIds: qIds,
    enablePause: true,
    pauseDurationMinutes: 15,
  })
  if (!r2.success) throw new Error(r2.error)
  pauseExamId = r2.examId
})

afterAll(async () => {
  await db.delete(exams).where(eq(exams.createdBy, ADMIN_ID))
  const uids = [ADMIN_ID, STUDENT_ID]
  await db.delete(userAccess).where(inArray(userAccess.userId, uids))
  await db.delete(transactions).where(inArray(transactions.userId, uids))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(inArray(user.id, uids))
})

describe("saveExamAnswer", () => {
  beforeAll(async () => {
    asStudent()
    await startExam({ examId })
  })

  it("saveExamAnswer enregistre la réponse correcte", async () => {
    asStudent()
    const res = await saveExamAnswer({
      examId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res.success).toBe(true)
    // isCorrect ne doit pas être retourné (anti-triche)
    expect(res).not.toHaveProperty("isCorrect")
  })

  it("saveExamAnswer enregistre une réponse incorrecte sans révéler l'info", async () => {
    asStudent()
    const res = await saveExamAnswer({
      examId,
      questionId: qIds[1],
      selectedAnswer: "B",
    })
    expect(res.success).toBe(true)
    expect(res).not.toHaveProperty("isCorrect")
  })

  it("saveExamAnswer refuse une question hors de l'examen", async () => {
    asStudent()
    const res = await saveExamAnswer({
      examId,
      questionId: createId(),
      selectedAnswer: "A",
    })
    expect(res.success).toBe(false)
  })
})

describe("saveExamFlag", () => {
  it("saveExamFlag marque une question", async () => {
    asStudent()
    const res = await saveExamFlag({
      examId,
      questionId: qIds[2],
      isFlagged: true,
    })
    expect(res.success).toBe(true)
  })

  it("saveExamFlag démarque une question", async () => {
    asStudent()
    const res = await saveExamFlag({
      examId,
      questionId: qIds[2],
      isFlagged: false,
    })
    expect(res.success).toBe(true)
  })
})

describe("finalizeExam", () => {
  it("finalizeExam calcule le bon score (1/6 correct = 17%)", async () => {
    asStudent()
    // qIds[0] = A (correct), qIds[1] = B (incorrect), rest unanswered
    const res = await finalizeExam({ examId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.correctAnswers).toBe(1)
    expect(res.totalQuestions).toBe(6)
    expect(res.score).toBe(17) // round(1/6 * 100)
  })

  it("finalizeExam refuse une 2e soumission (déjà complété)", async () => {
    asStudent()
    const res = await finalizeExam({ examId })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain("déjà")
    }
  })
})

describe("pauseExam + resumeExam", () => {
  beforeAll(async () => {
    asStudent()
    await startExam({ examId: pauseExamId })
  })

  it("pauseExam démarre la pause", async () => {
    asStudent()
    const res = await pauseExam({ examId: pauseExamId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.pauseStartedAt).toBeGreaterThan(0)
    expect(res.pauseDurationMinutes).toBe(15)

    const s = await getExamSession(pauseExamId)
    expect(s?.isPaused).toBe(true)
  })

  it("saveExamAnswer refuse pendant la pause", async () => {
    asStudent()
    const res = await saveExamAnswer({
      examId: pauseExamId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain("pause")
  })

  it("pauseExam refuse une 2e pause (déjà en pause)", async () => {
    asStudent()
    const res = await pauseExam({ examId: pauseExamId })
    expect(res.success).toBe(false)
  })

  it("resumeExam reprend l'examen", async () => {
    asStudent()
    const res = await resumeExam({ examId: pauseExamId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.totalPauseDurationMs).toBeGreaterThanOrEqual(0)

    const s = await getExamSession(pauseExamId)
    expect(s?.isPaused).toBe(false)
  })

  it("pauseExam refuse une 2e utilisation de pause", async () => {
    asStudent()
    // totalPauseDurationMs > 0 after resumeExam
    const res = await pauseExam({ examId: pauseExamId })
    expect(res.success).toBe(false)
    expect(res.error).toContain("déjà")
  })

  it("finalizeExam après pause réussit", async () => {
    asStudent()
    const res = await finalizeExam({ examId: pauseExamId })
    expect(res.success).toBe(true)
  })
})
