import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
  user,
} from "@/db/schema"
import { getOpenExamQuestionIds } from "@/features/exams/dal"
import { scoreQuizAnswers } from "@/features/questions/actions"
import {
  getQuizAnswerKey,
  getRandomQuizQuestions,
} from "@/features/questions/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const suffix = createId().slice(0, 8)
const DOMAIN = `QUIZ-${suffix}`

// qImg : 2 images, bonne réponse "A". q2 : aucune image, bonne réponse "B".
const qImg = createId()
const q2 = createId()
const ids = [qImg, q2, createId(), createId(), createId()] // 5 au total

// qOpen appartient à un examen OUVERT (endDate future) → verrouillée pour le
// canal public ; qClosed appartient à un examen CLOS uniquement → témoin
// (l'examen clos ne verrouille pas, pattern q10 de exams.test.ts).
const qOpen = ids[2]
const qClosed = ids[3]
const examCreatorId = createId()
const examOpenId = createId()
const examClosedId = createId()

const mkQuestion = (id: string, correct: string) =>
  db.insert(questions).values({
    id,
    question: `Question ${id.slice(0, 6)} ${suffix} ?`,
    correctAnswer: correct,
    options: ["A", "B", "C", "D"],
    objectifCmc: `OBJ-${suffix}`,
    domain: DOMAIN,
  })

beforeAll(async () => {
  await mkQuestion(qImg, "A")
  await mkQuestion(q2, "B")
  await Promise.all(ids.slice(2).map((id) => mkQuestion(id, "C")))

  await db.insert(questionExplanations).values([
    { questionId: qImg, explanation: "Exp img", references: ["R1", "R2"] },
    { questionId: q2, explanation: "Exp q2", references: null },
  ])

  await db.insert(questionImages).values([
    { questionId: qImg, storagePath: `quiz/${suffix}/1.jpg`, position: 1 },
    { questionId: qImg, storagePath: `quiz/${suffix}/0.jpg`, position: 0 },
  ])

  await db.insert(user).values({
    id: examCreatorId,
    name: "Créateur Examen Quiz",
    email: `quiz91-${suffix}@test.invalid`,
    emailVerified: true,
  })
  await db.insert(exams).values([
    {
      id: examOpenId,
      title: `Examen ouvert ${suffix}`,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      completionTime: 3600,
      createdBy: examCreatorId,
    },
    {
      id: examClosedId,
      title: `Examen clos ${suffix}`,
      startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      completionTime: 3600,
      createdBy: examCreatorId,
    },
  ])
  await db.insert(examQuestions).values([
    { examId: examOpenId, questionId: qOpen, position: 0 },
    { examId: examClosedId, questionId: qClosed, position: 0 },
  ])
})

afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, [examOpenId, examClosedId]))
  await db.delete(questionImages).where(inArray(questionImages.questionId, ids))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, ids))
  await db.delete(questions).where(inArray(questions.id, ids))
  await db.delete(user).where(eq(user.id, examCreatorId))
})

describe("getOpenExamQuestionIds (verrou anonyme)", () => {
  it("verrouille les questions d'un examen ouvert, pas celles d'un examen clos", async () => {
    const locked = await getOpenExamQuestionIds([
      qOpen,
      qClosed,
      q2,
      createId(),
    ])
    expect(locked).toEqual(new Set([qOpen]))
  })

  it("Set vide pour une liste vide", async () => {
    expect((await getOpenExamQuestionIds([])).size).toBe(0)
  })
})

describe("getRandomQuizQuestions", () => {
  it("borne le nombre, filtre par domaine et exclut les examens ouverts", async () => {
    const three = await getRandomQuizQuestions({ domain: DOMAIN, count: 3 })
    expect(three).toHaveLength(3)
    expect(three.every((q) => q.domain === DOMAIN)).toBe(true)

    // qOpen (examen ouvert) n'est jamais servie ; qClosed (examen clos) l'est.
    const servable = ids.filter((id) => id !== qOpen)
    const all = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
    expect(new Set(all.map((q) => q._id))).toEqual(new Set(servable))
  })

  it("ne sert jamais une question d'un examen ouvert (tirages répétés)", async () => {
    for (let i = 0; i < 5; i++) {
      const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
      expect(items.map((q) => q._id)).not.toContain(qOpen)
    }
  })

  it("clampe count à 10", async () => {
    const items = await getRandomQuizQuestions({ count: 50 })
    expect(items.length).toBeLessThanOrEqual(10)
  })

  it("ne fuite jamais correctAnswer ni explanation", async () => {
    const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
    for (const item of items) {
      expect(item).not.toHaveProperty("correctAnswer")
      expect(item).not.toHaveProperty("explanation")
    }
  })

  it("joint les images (URL CDN, triées par position)", async () => {
    const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
    const withImg = items.find((q) => q._id === qImg)
    expect(withImg?.images.map((i) => i.order)).toEqual([0, 1])
    expect(withImg?.images[0].url).toContain(`quiz/${suffix}/0.jpg`)
    expect(withImg?.images[0].url.startsWith("https://")).toBe(true)

    const noImg = items.find((q) => q._id === q2)
    expect(noImg?.images).toEqual([])
  })
})

describe("getQuizAnswerKey", () => {
  it("renvoie la clé (réponse + explication + références) pour les ids connus", async () => {
    const key = await getQuizAnswerKey([qImg, q2, createId()])
    expect(key.get(qImg)).toMatchObject({
      correctAnswer: "A",
      explanation: "Exp img",
      references: ["R1", "R2"],
    })
    expect(key.get(q2)?.references).toEqual([]) // null → []
    expect(key.size).toBe(2) // l'id inconnu est absent
  })

  it("Map vide pour une liste vide", async () => {
    expect((await getQuizAnswerKey([])).size).toBe(0)
  })
})

describe("scoreQuizAnswers (action publique)", () => {
  it("score côté serveur + renvoie l'explication ; ignore les ids inconnus", async () => {
    const result = await scoreQuizAnswers({
      answers: [
        { questionId: qImg, selectedAnswer: "A" }, // correct
        { questionId: q2, selectedAnswer: "mauvaise" }, // incorrect
        { questionId: createId(), selectedAnswer: null }, // inconnu → ignoré
      ],
    })

    expect(result.score).toBe(1)
    expect(result.totalQuestions).toBe(2)
    const imgResult = result.questionResults.find((r) => r.questionId === qImg)
    expect(imgResult).toMatchObject({
      isCorrect: true,
      correctAnswer: "A",
      explanation: "Exp img",
      references: ["R1", "R2"],
    })
  })
})
