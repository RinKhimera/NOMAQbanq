/**
 * Tests d'intégration : startExam pré-création + saveExamAnswer + saveExamFlag
 * + finalizeExam + pauseExam/resumeExam.
 * Couvre les tâches A3, A4, A5, A6 du plan de refonte.
 */
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  exams,
  products,
  questions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  createExam,
  finalizeExam,
  pauseExam,
  resumeExam,
  saveExamAnswer,
  saveExamFlag,
  startExam,
} from "@/features/exams/actions"
import { getExamSession, getExamWithQuestions } from "@/features/exams/dal"
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
const qIds = Array.from({ length: 4 }, () => createId())

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
    { id: ADMIN_ID, name: "ER admin", email: `er-adm-${suffix}@test.invalid` },
    {
      id: STUDENT_ID,
      name: "ER student",
      email: `er-stu-${suffix}@test.invalid`,
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
    stripeProductId: `prod_er_${suffix}`,
    stripePriceId: `price_er_${suffix}`,
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
      question: `ER Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj ER ${suffix}`,
      domain: `ER-${suffix}`,
    })),
  )

  asAdmin()
  const now = Date.now()
  const r1 = await createExam({
    title: `ER Exam ${suffix}`,
    startDate: now - 3600_000,
    endDate: now + 3600_000,
    questionIds: qIds,
    enablePause: false,
  })
  if (!r1.success) throw new Error(r1.error)
  examId = r1.examId

  const r2 = await createExam({
    title: `ER Pause Exam ${suffix}`,
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

describe("startExam pré-création", () => {
  it("crée une ligne examAnswers (selectedAnswer null) par question", async () => {
    asStudent()
    const res = await startExam({ examId })
    expect(res.success).toBe(true)
    expect(res).not.toHaveProperty("pausePhase")

    const [p] = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(eq(examParticipations.examId, examId))
    const rows = await db
      .select()
      .from(examAnswers)
      .where(eq(examAnswers.participationId, p.id))
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.selectedAnswer === null)).toBe(true)
    expect(rows.every((r) => r.isCorrect === null)).toBe(true)
  })

  it("startExam est idempotent (même participation si in_progress)", async () => {
    asStudent()
    const r1 = await startExam({ examId })
    const r2 = await startExam({ examId })
    expect(r1.success && r2.success).toBe(true)
    if (r1.success && r2.success) {
      expect(r1.participationId).toBe(r2.participationId)
    }
  })
})

describe("saveExamAnswer", () => {
  it("met à jour la ligne et ne renvoie JAMAIS isCorrect", async () => {
    asStudent()
    const view = await getExamWithQuestions(examId)
    const qId = view!.questions[0]._id
    const res = await saveExamAnswer({
      examId,
      questionId: qId,
      selectedAnswer: "A",
    })
    expect(res).toEqual({ success: true })
    expect(res).not.toHaveProperty("isCorrect")

    // Verify in DB that isCorrect was set server-side
    const [p] = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, STUDENT_ID),
        ),
      )
    const [row] = await db
      .select()
      .from(examAnswers)
      .where(
        and(
          eq(examAnswers.participationId, p.id),
          eq(examAnswers.questionId, qId),
        ),
      )
    expect(row.selectedAnswer).toBe("A")
    expect(row.isCorrect).toBe(true) // calculated server-side
  })

  it("saveExamAnswer sur question hors examen → échec", async () => {
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
  it("marque et démarque une question", async () => {
    asStudent()
    const view = await getExamWithQuestions(examId)
    const qId = view!.questions[1]._id

    const r1 = await saveExamFlag({ examId, questionId: qId, isFlagged: true })
    expect(r1.success).toBe(true)

    const r2 = await saveExamFlag({ examId, questionId: qId, isFlagged: false })
    expect(r2.success).toBe(true)
  })
})

describe("finalizeExam", () => {
  it("calcule le score depuis les lignes en base", async () => {
    asStudent()
    const view = await getExamWithQuestions(examId)
    const ids = view!.questions.map((q) => q._id)
    // qIds[0] already answered A (correct); save q[2] incorrect
    await saveExamAnswer({ examId, questionId: ids[2], selectedAnswer: "B" })

    const res = await finalizeExam({ examId })
    expect(res.success).toBe(true)
    if (!res.success) return
    // 1 correct (idx 0, A), 1 incorrect (idx 2, B), 2 unanswered = 1/4 = 25
    expect(res.correctAnswers).toBe(1)
    expect(res.totalQuestions).toBe(4)
    expect(res.score).toBe(25)
  })

  it("finalizeExam refuse une 2e soumission", async () => {
    asStudent()
    const res = await finalizeExam({ examId })
    expect(res.success).toBe(false)
  })
})

describe("pauseExam / resumeExam", () => {
  it("une seule pause autorisée ; resume cumule la durée", async () => {
    asStudent()
    await startExam({ examId: pauseExamId })

    const r1 = await pauseExam({ examId: pauseExamId })
    expect(r1.success).toBe(true)

    const s1 = await getExamSession(pauseExamId)
    expect(s1?.isPaused).toBe(true)

    // Already paused → refuse
    const r2 = await pauseExam({ examId: pauseExamId })
    expect(r2.success).toBe(false)

    // Resume
    const r3 = await resumeExam({ examId: pauseExamId })
    expect(r3.success).toBe(true)
    if (r3.success) {
      expect(r3.totalPauseDurationMs).toBeGreaterThanOrEqual(0)
    }

    const s2 = await getExamSession(pauseExamId)
    expect(s2?.isPaused).toBe(false)

    // Pause already used → refuse
    const r4 = await pauseExam({ examId: pauseExamId })
    expect(r4.success).toBe(false)
  })

  it("saveExamAnswer refuse pendant la pause (simulation)", async () => {
    // Create a separate exam for this test
    asAdmin()
    const now = Date.now()
    const r = await createExam({
      title: `ER Pause2 ${suffix}`,
      startDate: now - 3600_000,
      endDate: now + 3600_000,
      questionIds: qIds,
      enablePause: true,
      pauseDurationMinutes: 15,
    })
    if (!r.success) throw new Error(r.error)
    const pExamId = r.examId

    asStudent()
    await startExam({ examId: pExamId })
    await pauseExam({ examId: pExamId })

    const res = await saveExamAnswer({
      examId: pExamId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain("pause")
  })
})
