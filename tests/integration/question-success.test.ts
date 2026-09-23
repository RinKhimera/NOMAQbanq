import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import { getQuestionAnswerBreakdown } from "@/features/analytics/dal"
import { getQuestionsWithFilters } from "@/features/questions/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const suffix = createId().slice(0, 8)
const createdUsers: string[] = []
const createdQuestions: string[] = []
const createdSessions: string[] = []

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 10, minute))

const newQuestion = async () => {
  const id = createId()
  createdQuestions.push(id)
  await db.insert(questions).values({
    id,
    question: `Réussite ${suffix} ${id}`,
    correctAnswer: "A",
    options: ["A", "B", "C"],
    objectifCmc: "Objectif",
    domain: "Cardiologie",
  })
  return id
}

const newUser = async (
  role: "user" | "admin" = "user",
  { deleted = false }: { deleted?: boolean } = {},
) => {
  const id = createId()
  createdUsers.push(id)
  await db.insert(user).values({
    id,
    name: "Réussite",
    email: `success-${id}-${suffix}@test.invalid`,
    role,
    deletedAt: deleted ? new Date() : null,
  })
  return id
}

/** Réponse d'entraînement de `userId` à `questionId`, choisie parmi A/B/C (clé : A). */
const answer = async (
  userId: string,
  questionId: string,
  selected: "A" | "B" | "C",
  answeredAt = at(0),
) => {
  const sessionId = createId()
  createdSessions.push(sessionId)
  await db.insert(trainingSessions).values({
    id: sessionId,
    userId,
    status: "completed",
    mode: "test",
    questionCount: 1,
    startedAt: answeredAt,
    expiresAt: at(59),
  })
  await db.insert(trainingSessionItems).values({
    sessionId,
    questionId,
    position: 0,
    selectedAnswer: selected,
    isCorrect: selected === "A",
    answeredAt,
  })
}

/** Autant d'étudiants que de choix, chacun répondant une fois. */
const answeredBy = async (questionId: string, choices: ("A" | "B" | "C")[]) => {
  for (const choice of choices)
    await answer(await newUser(), questionId, choice)
}

const rowOf = async (questionId: string) =>
  (await getQuestionsWithFilters({ search: suffix, limit: 100 })).items.find(
    (q) => q.id === questionId,
  )

beforeAll(() => {
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)
})

afterAll(async () => {
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.id, createdSessions))
  await db.delete(questions).where(inArray(questions.id, createdQuestions))
  await db.delete(user).where(inArray(user.id, createdUsers))
})

describe("taux de réussite d'une question", () => {
  it("rend la part de premières réponses justes et leur nombre", async () => {
    const q = await newQuestion()
    await answeredBy(q, ["A", "A", "A", "A", "A", "A", "A", "B", "B", "C"])
    expect(await rowOf(q)).toMatchObject({ answerCount: 10, successRate: 70 })
  })

  it("compte la première réponse d'un étudiant, pas sa révision", async () => {
    const q = await newQuestion()
    await answeredBy(q, ["A", "A", "A", "A", "A", "A", "A", "A", "A"])
    const reviser = await newUser()
    await answer(reviser, q, "B", at(1))
    await answer(reviser, q, "A", at(2))
    expect(await rowOf(q)).toMatchObject({ answerCount: 10, successRate: 90 })
  })

  it("jumeau : une première réponse juste reste juste malgré une erreur ensuite", async () => {
    const q = await newQuestion()
    await answeredBy(q, ["A", "A", "A", "A", "A", "A", "A", "A", "A"])
    const reviser = await newUser()
    await answer(reviser, q, "A", at(1))
    await answer(reviser, q, "B", at(2))
    expect(await rowOf(q)).toMatchObject({ answerCount: 10, successRate: 100 })
  })

  it("n'a pas de taux sous 10 réponses", async () => {
    const q = await newQuestion()
    await answeredBy(q, ["A", "A", "A", "A", "A", "B", "B", "B", "B"])
    expect(await rowOf(q)).toMatchObject({ answerCount: 9, successRate: null })
  })

  it("ignore les réponses des comptes admin et supprimés", async () => {
    const q = await newQuestion()
    await answeredBy(q, ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A"])
    await answer(await newUser("admin"), q, "B")
    await answer(await newUser("user", { deleted: true }), q, "B")
    expect(await rowOf(q)).toMatchObject({ answerCount: 10, successRate: 100 })
  })
})

describe("filtre « À vérifier » et tri par taux de réussite", () => {
  const listed = async (
    filters: Parameters<typeof getQuestionsWithFilters>[0],
  ) =>
    (
      await getQuestionsWithFilters({ search: suffix, limit: 100, ...filters })
    ).items.map((q) => q.id)

  let suspect: string
  let tied: string
  let tooFew: string
  let solidSuspect: string
  let easy: string

  beforeAll(async () => {
    suspect = await newQuestion()
    await answeredBy(suspect, [
      "A",
      "A",
      "A",
      "A",
      "B",
      "B",
      "B",
      "B",
      "B",
      "C",
    ])
    tied = await newQuestion()
    await answeredBy(tied, ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B"])
    tooFew = await newQuestion()
    await answeredBy(tooFew, ["A", "B", "B", "B", "B", "B", "B", "B", "B"])
    solidSuspect = await newQuestion()
    await answeredBy(solidSuspect, [
      ...Array<"A">(5).fill("A"),
      ...Array<"B">(7).fill("B"),
    ])
    easy = await newQuestion()
    await answeredBy(easy, Array<"A">(10).fill("A"))
  })

  it("isole les questions où une autre option est strictement plus choisie que la clé, les plus répondues d'abord", async () => {
    const ids = await listed({ toVerify: true })
    expect(ids).toEqual([solidSuspect, suspect])
  })

  it("compte le filtre dans le total paginé", async () => {
    const page = await getQuestionsWithFilters({
      search: suffix,
      limit: 1,
      toVerify: true,
    })
    expect(page.total).toBe(2)
  })

  it("trie par taux croissant, les questions non significatives en fin", async () => {
    const ids = await listed({ sortBy: "successRate", sortOrder: "asc" })
    // 40 %, 42 %, 50 %, 100 %.
    const scored = [suspect, solidSuspect, tied, easy]
    expect(ids.filter((id) => scored.includes(id))).toEqual(scored)
    expect(ids.indexOf(tooFew)).toBeGreaterThan(ids.indexOf(easy))
  })

  it("trie par taux décroissant, les questions non significatives toujours en fin", async () => {
    const ids = await listed({ sortBy: "successRate", sortOrder: "desc" })
    const scored = [easy, tied, solidSuspect, suspect]
    expect(ids.filter((id) => scored.includes(id))).toEqual(scored)
    expect(ids.indexOf(tooFew)).toBeGreaterThan(ids.indexOf(suspect))
  })
})

describe("répartition des réponses d'une question", () => {
  it("rend chaque option avec son nombre et sa part, la clé marquée, cohérente avec le taux", async () => {
    const q = await newQuestion()
    await answeredBy(q, ["A", "A", "A", "A", "A", "A", "B", "B", "B", "A"])
    const breakdown = await getQuestionAnswerBreakdown(q)
    expect(breakdown).toEqual({
      answerCount: 10,
      successRate: 70,
      options: [
        { option: "A", count: 7, share: 70, isKey: true },
        { option: "B", count: 3, share: 30, isKey: false },
        { option: "C", count: 0, share: 0, isKey: false },
      ],
    })
    expect((await rowOf(q))?.successRate).toBe(breakdown.successRate)
  })

  it("est refusée à un étudiant", async () => {
    const q = await newQuestion()
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "student", role: "user" },
    } as never)
    await expect(getQuestionAnswerBreakdown(q)).rejects.toThrow()
  })
})
