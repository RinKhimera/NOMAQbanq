import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
  user,
} from "@/db/schema"
import { getExamsForPicker } from "@/features/exams/dal"
import { getObjectiveOptions } from "@/features/objectives/dal"
import {
  getQuestionById,
  getQuestionStats,
  getQuestionsForExport,
  getQuestionsWithFilters,
} from "@/features/questions/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { objectiveIdFor } from "../helpers/objective"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const DOMAIN = "Domaine test"
const OBJ = "Objectif test"

const q1 = createId() // 2 images, "alpha"
const q2 = createId() // 0 image, "beta"
const q3 = createId() // 0 image, "gamma"
const examId = createId() // examen qui utilise UNIQUEMENT q1
const creatorId = createId() // créateur de l'examen (FK createdBy)

const mkQuestion = async (id: string, label: string, createdAt: Date) =>
  db.insert(questions).values({
    id,
    question: `Question ${label} ?`,
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectiveId: await objectiveIdFor(OBJ),
    domain: DOMAIN,
    createdAt,
  })

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)

  const now = Date.now()
  await mkQuestion(q1, "alpha", new Date(now - 3 * DAY))
  await mkQuestion(q2, "beta", new Date(now - 2 * DAY))
  await mkQuestion(q3, "gamma", new Date(now - 1 * DAY))

  await db.insert(questionExplanations).values([
    {
      questionId: q1,
      explanation: "Explication q1",
      references: ["Ref A", "Ref B"],
    },
    { questionId: q2, explanation: "Explication q2", references: null },
    { questionId: q3, explanation: "Explication q3", references: null },
  ])

  await db.insert(questionImages).values([
    { questionId: q1, storagePath: "p/1.jpg", position: 1 },
    { questionId: q1, storagePath: "p/0.jpg", position: 0 },
  ])

  // Fixtures d'usage : un examen qui référence UNIQUEMENT q1.
  await db.insert(user).values({
    id: creatorId,
    name: "Creator",
    email: "creator@test.invalid",
    role: "admin",
  })
  await db.insert(exams).values({
    id: examId,
    title: "Examen",
    startDate: new Date(now - 5 * DAY),
    endDate: new Date(now + 5 * DAY),
    completionTime: 3600,
    createdBy: creatorId,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  await db.insert(examQuestions).values({ examId, questionId: q1, position: 0 })
})

describe("getQuestionsWithFilters", () => {
  it("filtre domaine, ordre desc, compte d'images", async () => {
    const page = await getQuestionsWithFilters({ domain: DOMAIN })
    expect(page.items.map((q) => q.id)).toEqual([q3, q2, q1]) // createdAt desc
    expect(page.items.find((q) => q.id === q1)?.imageCount).toBe(2)
    expect(page.items.find((q) => q.id === q2)?.imageCount).toBe(0)
  })

  it("pagination par offset + total filtré", async () => {
    const p1 = await getQuestionsWithFilters({
      domain: DOMAIN,
      limit: 2,
      page: 1,
    })
    expect(p1.items.map((q) => q.id)).toEqual([q3, q2]) // createdAt desc
    expect(p1.total).toBe(3)

    const p2 = await getQuestionsWithFilters({
      domain: DOMAIN,
      limit: 2,
      page: 2,
    })
    expect(p2.items.map((q) => q.id)).toEqual([q1])
    expect(p2.total).toBe(3)
  })

  it("recherche : matche aussi objectifCMC", async () => {
    const page = await getQuestionsWithFilters({ search: OBJ })
    expect(page.items.map((q) => q.id).sort()).toEqual([q1, q2, q3].sort())
  })

  it("usageCount + filtres d'usage (used / unused / usedInExamId)", async () => {
    const all = await getQuestionsWithFilters({ domain: DOMAIN })
    expect(all.items.find((q) => q.id === q1)?.usageCount).toBe(1)
    expect(all.items.find((q) => q.id === q2)?.usageCount).toBe(0)

    const used = await getQuestionsWithFilters({
      domain: DOMAIN,
      usageFilter: "used",
    })
    expect(used.items.map((q) => q.id)).toEqual([q1])
    expect(used.total).toBe(1)

    const unused = await getQuestionsWithFilters({
      domain: DOMAIN,
      usageFilter: "unused",
    })
    expect(unused.items.map((q) => q.id).sort()).toEqual([q2, q3].sort())

    const inExam = await getQuestionsWithFilters({
      domain: DOMAIN,
      usedInExamId: examId,
    })
    expect(inExam.items.map((q) => q.id)).toEqual([q1])
  })

  it("getExamsForPicker liste l'examen fixture", async () => {
    const options = await getExamsForPicker()
    expect(options.map((e) => [e.id, e.title])).toEqual([[examId, "Examen"]])
  })

  it("export : la recherche matche aussi objectifCMC", async () => {
    const rows = await getQuestionsForExport({ search: OBJ })
    expect(rows.map((r) => r.id).sort()).toEqual([q1, q2, q3].sort())
  })

  it("export : suit les filtres d'usage (used / unused / usedInExamId)", async () => {
    const ids = async (filters: Parameters<typeof getQuestionsForExport>[0]) =>
      (await getQuestionsForExport({ domain: DOMAIN, ...filters }))
        .map((r) => r.id)
        .sort()

    expect(await ids({ usageFilter: "used" })).toEqual([q1])
    expect(await ids({ usageFilter: "unused" })).toEqual([q2, q3].sort())
    expect(await ids({ usedInExamId: examId })).toEqual([q1])
  })

  it("export : une question sans réponse a 0 réponse et aucun taux", async () => {
    const rows = await getQuestionsForExport({ domain: DOMAIN })
    expect(rows.find((r) => r.id === q2)).toMatchObject({
      answerCount: 0,
      successRate: null,
    })
  })

  it("filtre hasImages (EXISTS / NOT EXISTS)", async () => {
    const withImg = await getQuestionsWithFilters({
      domain: DOMAIN,
      hasImages: true,
    })
    expect(withImg.items.map((q) => q.id)).toEqual([q1])

    const without = await getQuestionsWithFilters({
      domain: DOMAIN,
      hasImages: false,
    })
    expect(new Set(without.items.map((q) => q.id))).toEqual(new Set([q2, q3]))
  })

  it("recherche ILIKE sur le texte", async () => {
    const page = await getQuestionsWithFilters({ search: "alpha" })
    expect(page.items.map((q) => q.id)).toEqual([q1])
  })
})

describe("getQuestionById", () => {
  it("joint explication (références) + images triées par position", async () => {
    const q = await getQuestionById(q1)
    expect(q?.explanation).toBe("Explication q1")
    expect(q?.references).toEqual(["Ref A", "Ref B"])
    expect(q?.images.map((i) => i.position)).toEqual([0, 1]) // trié
    expect(q?.options).toEqual(["A", "B", "C", "D"])
  })

  it("null si inexistant", async () => {
    expect(await getQuestionById(createId())).toBeNull()
  })
})

describe("getObjectiveOptions", () => {
  it("rattache l'objectif seedé à son domaine", async () => {
    const id = await objectiveIdFor(OBJ)
    const { objectives, byDomain } = await getObjectiveOptions()
    expect(byDomain[DOMAIN]).toEqual([id])
    expect(objectives).toContainEqual({ id, label: OBJ })
  })

  it("ne propose jamais une entrée à corriger", async () => {
    const id = await objectiveIdFor("- à corriger", { needsFix: true })
    const { objectives } = await getObjectiveOptions()
    expect(objectives.map((o) => o.id)).not.toContain(id)
  })
})

describe("getQuestionStats", () => {
  it("total + répartition domaine", async () => {
    expect(await getQuestionStats()).toEqual({
      totalCount: 3,
      domainStats: [{ domain: DOMAIN, count: 3 }],
    })
  })
})
