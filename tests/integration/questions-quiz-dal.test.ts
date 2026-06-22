import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/db"
import { questionExplanations, questionImages, questions } from "@/db/schema"
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

import { scoreQuizAnswers } from "@/features/questions/actions"
import {
  getQuizAnswerKey,
  getRandomQuizQuestions,
} from "@/features/questions/dal"

const suffix = createId().slice(0, 8)
const DOMAIN = `QUIZ-${suffix}`

// qImg : 2 images, bonne réponse "A". q2 : aucune image, bonne réponse "B".
const qImg = createId()
const q2 = createId()
const ids = [qImg, q2, createId(), createId(), createId()] // 5 au total

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
})

afterAll(async () => {
  await db.delete(questionImages).where(inArray(questionImages.questionId, ids))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, ids))
  await db.delete(questions).where(inArray(questions.id, ids))
})

describe("getRandomQuizQuestions", () => {
  it("borne le nombre et filtre par domaine", async () => {
    const three = await getRandomQuizQuestions({ domain: DOMAIN, count: 3 })
    expect(three).toHaveLength(3)
    expect(three.every((q) => q.domain === DOMAIN)).toBe(true)

    const all = await getRandomQuizQuestions({ domain: DOMAIN, count: 50 })
    expect(all).toHaveLength(5)
    expect(new Set(all.map((q) => q._id))).toEqual(new Set(ids))
  })

  it("ne fuite jamais correctAnswer ni explanation", async () => {
    const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 50 })
    for (const item of items) {
      expect(item).not.toHaveProperty("correctAnswer")
      expect(item).not.toHaveProperty("explanation")
    }
  })

  it("joint les images (URL CDN, triées par position)", async () => {
    const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 50 })
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
    const imgResult = result.questionResults.find(
      (r) => r.questionId === qImg,
    )
    expect(imgResult).toMatchObject({
      isCorrect: true,
      correctAnswer: "A",
      explanation: "Exp img",
      references: ["R1", "R2"],
    })
  })
})
