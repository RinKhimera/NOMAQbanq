/**
 * Tests d'intégration : garde anti-triche de projection (tâche A9).
 *
 * Vérifie qu'aucun champ sensible n'est exposé au client par la couche DAL
 * pendant une passation en cours :
 *   - examen : `getExamWithQuestions` pour un étudiant (non-admin) avec accès actif ;
 *   - entraînement mode test : `getTrainingSessionById` in_progress (questions +
 *     entrée `answers` après une réponse).
 *
 * Garde paramétrée sur SENSITIVE — c'est le seul objet de ce fichier (le flux
 * complet de passation est couvert par exam-runner.test.ts / training-mode.test.ts).
 */
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  exams,
  products,
  questionExplanations,
  questions,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import { createExam } from "@/features/exams/actions"
import { getExamWithQuestions } from "@/features/exams/dal"
import {
  abandonTrainingSession,
  createTrainingSession,
  saveTrainingAnswer,
} from "@/features/training/actions"
import { getTrainingSessionById } from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

/**
 * Champs jamais exposés au client tant qu'une session est en cours (non révélée).
 */
const SENSITIVE = [
  "correctAnswer",
  "explanation",
  "references",
  "isCorrect",
  "explanationImages",
] as const

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const ADMIN_ID = createId()
const STUDENT_ID = createId()
const PID = createId()
const DOMAIN = `AC-${suffix}`
const OBJ = `Obj AC ${suffix}`
const qIds = Array.from({ length: 6 }, () => createId())

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")

const expectNoSensitive = (obj: Record<string, unknown>) => {
  for (const k of SENSITIVE) {
    expect(obj[k]).toBeUndefined()
  }
}

let examId: string

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
  // Accès actif examen ET entraînement pour l'étudiant.
  await db.insert(userAccess).values([
    {
      userId: STUDENT_ID,
      accessType: "exam",
      expiresAt: new Date(Date.now() + 10 * DAY),
      lastTransactionId: txId,
    },
    {
      userId: STUDENT_ID,
      accessType: "training",
      expiresAt: new Date(Date.now() + 10 * DAY),
      lastTransactionId: txId,
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `AC Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: OBJ,
      domain: DOMAIN,
    })),
  )
  await db.insert(questionExplanations).values(
    qIds.map((id, i) => ({
      questionId: id,
      explanation: `Explication AC ${i} ${suffix}`,
      references: i === 0 ? ["Ref AC 1"] : null,
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
})

afterAll(async () => {
  await db
    .delete(trainingSessions)
    .where(eq(trainingSessions.userId, STUDENT_ID))
  await db.delete(exams).where(eq(exams.createdBy, ADMIN_ID))
  const uids = [ADMIN_ID, STUDENT_ID]
  await db.delete(userAccess).where(inArray(userAccess.userId, uids))
  await db.delete(transactions).where(inArray(transactions.userId, uids))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, qIds))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(inArray(user.id, uids))
})

describe("garde anti-triche : projection des champs sensibles", () => {
  it("examen (non-admin) : getExamWithQuestions n'expose aucun champ sensible", async () => {
    asStudent()
    const view = await getExamWithQuestions(examId)
    expect(view).not.toBeNull()
    expect(view!.questions.length).toBeGreaterThan(0)

    for (const q of view!.questions) {
      expectNoSensitive(q as Record<string, unknown>)
    }
  })

  it("entraînement mode test in_progress : getTrainingSessionById n'expose aucun champ sensible", async () => {
    asStudent()
    // questionCount min = 5 (schéma) ; 6 questions seedées dans ce domaine.
    const c = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(c.success).toBe(true)
    if (!c.success) return
    const sessionId = c.sessionId

    try {
      const v0 = await getTrainingSessionById(sessionId)
      expect(v0).not.toBeNull()
      expect(v0!.questions.length).toBeGreaterThan(0)

      // Aucune question ne révèle de champ sensible avant réponse.
      for (const q of v0!.questions) {
        expectNoSensitive(q as Record<string, unknown>)
      }

      // Répondre à une question puis re-fetcher.
      const q = v0!.questions[0]
      await saveTrainingAnswer({
        sessionId,
        questionId: q._id,
        selectedAnswer: q.options[0],
      })

      const v1 = await getTrainingSessionById(sessionId)
      expect(v1).not.toBeNull()

      // Les questions restent sans champ sensible (mode test in_progress).
      for (const qv of v1!.questions) {
        expectNoSensitive(qv as Record<string, unknown>)
      }

      // L'entrée answers contient selectedAnswer mais PAS isCorrect.
      const entry = v1!.answers[q._id]
      expect(entry?.selectedAnswer).toBeDefined()
      expect(
        (entry as Record<string, unknown> | undefined)?.isCorrect,
      ).toBeUndefined()
    } finally {
      await abandonTrainingSession({ sessionId })
    }
  })
})
