/**
 * Tests d'intégration : mode tuteur vs mode test.
 * Vérifie la révélation immédiate en mode tuteur et l'absence de fuite
 * isCorrect/correctAnswer en mode test in_progress.
 * Couvre la tâche A8 du plan de refonte.
 */
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  questionExplanations,
  questions,
  trainingSessions,
  user,
} from "@/db/schema"
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

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const DOMAIN = `TM-${suffix}`
const OBJ = `Obj TM ${suffix}`
const qIds = Array.from({ length: 6 }, () => createId())

const asAdmin = () =>
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id: USER_ID, role: "admin" },
  } as never)

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT training-mode",
    email: `tm-${suffix}@test.invalid`,
  })
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `TM Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: OBJ,
      domain: DOMAIN,
    })),
  )
  await db.insert(questionExplanations).values(
    qIds.map((id, i) => ({
      questionId: id,
      explanation: `Explication TM ${i} ${suffix}`,
      references: i === 0 ? ["Ref TM 1"] : null,
    })),
  )
  asAdmin()
})

afterAll(async () => {
  await db.delete(trainingSessions).where(eq(trainingSessions.userId, USER_ID))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, qIds))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(eq(user.id, USER_ID))
})

describe("mode entraînement", () => {
  it("tuteur : saveTrainingAnswer révèle correctAnswer + explanation", async () => {
    asAdmin()
    const c = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "tutor",
    })
    expect(c.success).toBe(true)
    if (!c.success) return
    const sessionId = c.sessionId

    try {
      const view = await getTrainingSessionById(sessionId)
      expect(view).not.toBeNull()
      const q = view!.questions[0]

      const res = await saveTrainingAnswer({
        sessionId,
        questionId: q._id,
        selectedAnswer: q.options[0],
      })
      expect(res.success).toBe(true)
      if (!res.success) return
      expect(typeof res.isCorrect).toBe("boolean")
      expect(res.reveal).toBeDefined()
      expect(typeof res.reveal?.correctAnswer).toBe("string")
      expect(res.reveal?.correctAnswer).toBe("A")
    } finally {
      await abandonTrainingSession({ sessionId })
    }
  })

  it("test : saveTrainingAnswer ne révèle PAS (pas de reveal)", async () => {
    asAdmin()
    const c = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(c.success).toBe(true)
    if (!c.success) return
    const sessionId = c.sessionId

    try {
      const view = await getTrainingSessionById(sessionId)
      expect(view).not.toBeNull()
      const q = view!.questions[0]

      const res = await saveTrainingAnswer({
        sessionId,
        questionId: q._id,
        selectedAnswer: q.options[0],
      })
      expect(res.success).toBe(true)
      if (!res.success) return
      // En mode test, isCorrect ne doit PAS voyager sur le fil réseau (anti-triche)
      expect(res.isCorrect).toBeUndefined()
      expect(res.reveal).toBeUndefined()
    } finally {
      await abandonTrainingSession({ sessionId })
    }
  })

  it("test : getTrainingSessionById in_progress ne renvoie PAS isCorrect dans answers", async () => {
    asAdmin()
    const c = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    if (!c.success) throw new Error(c.error)
    const sessionId = c.sessionId

    try {
      const v0 = await getTrainingSessionById(sessionId)
      expect(v0).not.toBeNull()
      const q = v0!.questions[0]

      await saveTrainingAnswer({
        sessionId,
        questionId: q._id,
        selectedAnswer: q.options[0],
      })

      const v1 = await getTrainingSessionById(sessionId)
      expect(v1).not.toBeNull()
      // Answer exists but isCorrect must not be exposed in test mode in_progress
      expect(v1!.answers[q._id]?.selectedAnswer).toBeDefined()
      expect(v1!.answers[q._id]?.isCorrect).toBeUndefined()
    } finally {
      await abandonTrainingSession({ sessionId })
    }
  })

  it("tuteur in_progress : ne révèle correctAnswer que pour les questions répondues", async () => {
    asAdmin()
    const c = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "tutor",
    })
    if (!c.success) throw new Error(c.error)
    const sessionId = c.sessionId

    try {
      const v0 = await getTrainingSessionById(sessionId)
      expect(v0).not.toBeNull()
      const qs = v0!.questions

      // Answer only the first question
      await saveTrainingAnswer({
        sessionId,
        questionId: qs[0]._id,
        selectedAnswer: qs[0].options[0],
      })

      const v1 = await getTrainingSessionById(sessionId)
      expect(v1).not.toBeNull()

      // Answered question → correctAnswer revealed
      expect(v1!.questions[0].correctAnswer).toBeDefined()

      // Unanswered question → correctAnswer NOT revealed (anti-cheat)
      expect(v1!.questions[1].correctAnswer).toBeUndefined()
    } finally {
      await abandonTrainingSession({ sessionId })
    }
  })

  it("tuteur : getTrainingSessionById révèle isCorrect dans answers pour les réponses enregistrées", async () => {
    asAdmin()
    const c = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "tutor",
    })
    if (!c.success) throw new Error(c.error)
    const sessionId = c.sessionId

    try {
      const v0 = await getTrainingSessionById(sessionId)
      const q = v0!.questions[0]

      await saveTrainingAnswer({
        sessionId,
        questionId: q._id,
        selectedAnswer: "A", // correct answer
      })

      const v1 = await getTrainingSessionById(sessionId)
      // In tutor mode, isCorrect IS exposed in answers
      expect(v1!.answers[q._id]?.isCorrect).toBe(true)
    } finally {
      await abandonTrainingSession({ sessionId })
    }
  })
})
