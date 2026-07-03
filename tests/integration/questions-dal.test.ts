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
import { getExamsForPicker } from "@/features/exams/dal"
import {
  type QuestionStatsEnriched,
  getQuestionById,
  getQuestionStatsEnriched,
  getQuestionsForExport,
  getQuestionsWithFilters,
  getUniqueObjectifsCMC,
} from "@/features/questions/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const DOMAIN = `DOM-${suffix}`
const OBJ = `OBJ-${suffix}`

const q1 = createId() // 2 images, "alpha"
const q2 = createId() // 0 image, "beta"
const q3 = createId() // 0 image, "gamma"
const examId = createId() // examen qui utilise UNIQUEMENT q1
const creatorId = createId() // créateur de l'examen (FK createdBy)

let baseline: QuestionStatsEnriched

const mkQuestion = (id: string, label: string, createdAt: Date) =>
  db.insert(questions).values({
    id,
    question: `Question ${label} ${suffix} ?`,
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectifCmc: OBJ,
    domain: DOMAIN,
    createdAt,
  })

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)

  baseline = await getQuestionStatsEnriched()

  const now = Date.now()
  await mkQuestion(q1, `alpha${suffix}`, new Date(now - 3 * DAY))
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
    { questionId: q1, storagePath: `p/${suffix}/1.jpg`, position: 1 },
    { questionId: q1, storagePath: `p/${suffix}/0.jpg`, position: 0 },
  ])

  // Fixtures d'usage : un examen qui référence UNIQUEMENT q1.
  await db.insert(user).values({
    id: creatorId,
    name: `Creator ${suffix}`,
    email: `creator-${suffix}@test.invalid`,
    role: "admin",
  })
  await db.insert(exams).values({
    id: examId,
    title: `Examen ${suffix}`,
    startDate: new Date(now - 5 * DAY),
    endDate: new Date(now + 5 * DAY),
    completionTime: 3600,
    createdBy: creatorId,
  })
  await db.insert(examQuestions).values({ examId, questionId: q1, position: 0 })
})

afterAll(async () => {
  const ids = [q1, q2, q3]
  // FK restrict : enfants avant parents (examQuestions avant exams/questions).
  await db.delete(examQuestions).where(eq(examQuestions.examId, examId))
  await db.delete(exams).where(eq(exams.id, examId))
  await db.delete(user).where(eq(user.id, creatorId))
  await db.delete(questionImages).where(inArray(questionImages.questionId, ids))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, ids))
  await db.delete(questions).where(inArray(questions.id, ids))
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
    expect(options.find((e) => e.id === examId)?.title).toBe(`Examen ${suffix}`)
    expect(options.length).toBeLessThanOrEqual(500)
  })

  it("export : la recherche matche aussi objectifCMC", async () => {
    const rows = await getQuestionsForExport({ search: OBJ })
    expect(rows.map((r) => r.id).sort()).toEqual([q1, q2, q3].sort())
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
    const page = await getQuestionsWithFilters({ search: `alpha${suffix}` })
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

describe("getUniqueObjectifsCMC", () => {
  it("inclut l'objectif seedé", async () => {
    const objs = await getUniqueObjectifsCMC()
    expect(objs).toContain(OBJ)
  })
})

describe("getQuestionStatsEnriched (delta)", () => {
  it("total + withImages + répartition domaine", async () => {
    const after = await getQuestionStatsEnriched()
    expect(after.totalCount - baseline.totalCount).toBe(3)
    expect(after.withImagesCount - baseline.withImagesCount).toBe(1)
    const myDomain = after.domainStats.find((d) => d.domain === DOMAIN)
    expect(myDomain?.count).toBe(3)
  })
})
