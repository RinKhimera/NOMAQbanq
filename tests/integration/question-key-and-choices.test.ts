import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { examQuestions, exams, questions, user } from "@/db/schema"
import { getQuestionAnswerBreakdown } from "@/features/analytics/dal"
import {
  confirmQuestionKey,
  createQuestion,
  createQuestionImageUpload,
  deleteQuestion,
  setQuestionImages,
  updateQuestion,
} from "@/features/questions/actions"
import { getQuestionById, getQuestionList } from "@/features/questions/dal"
import { requireRole } from "@/lib/auth-guards"
import { createPresignedUpload } from "@/lib/aws"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID, objectiveIdFor } from "../helpers/objective"
import { seedAnswers } from "../helpers/seed-answers"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(),
  deleteFromS3: vi.fn(),
  copyInS3: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>()
  return {
    ...actual,
    isStorageConfigured: () => true,
    tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
  }
})

const DOMAIN = "Cardiologie"
const adminId = createId()

const base = {
  question: "Clé",
  options: ["A", "B", "C", "D"],
  correctAnswer: "A",
  explanation: "Parce que.",
  references: ["R1"],
  objectiveId: TEST_OBJECTIVE_ID,
  domain: DOMAIN,
}

const asAdmin = () =>
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, role: "admin" },
  } as never)

const newQuestion = async (over: Partial<typeof base> = {}) => {
  const res = await createQuestion({ ...base, ...over })
  if (!res.success) throw new Error(res.error)
  return res.id
}

/** `a` premières réponses justes (A) et `b` fausses (B), d'autant d'étudiants. */
const answerMany = (questionId: string, a: number, b: number) =>
  seedAnswers(questionId, [...Array(a).fill("A"), ...Array(b).fill("B")])

const inToVerify = async (id: string) =>
  (await getQuestionList({ search: id, toVerify: true, limit: 20 })).items.some(
    (q) => q.id === id,
  )

const mkExam = async (questionId: string, endDate: Date) => {
  const id = createId()
  await db.insert(exams).values({
    id,
    title: "Examen",
    startDate: new Date(Date.now() - 86_400_000),
    endDate,
    completionTime: 3600,
    createdBy: adminId,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  await db.insert(examQuestions).values({ examId: id, questionId, position: 0 })
}

beforeAll(async () => {
  await db.insert(user).values({
    id: adminId,
    name: "Admin",
    email: "admin@test.invalid",
    role: "admin",
  })
})

beforeEach(() => {
  asAdmin()
})

describe("clé confirmée", () => {
  it("sort la question de « Clé à vérifier », jusqu'au doublement des réponses", async () => {
    const id = await newQuestion()
    await answerMany(id, 4, 6)
    expect(await inToVerify(id)).toBe(true)
    expect((await getQuestionAnswerBreakdown(id)).keySuspect).toBe(true)

    expect(
      await confirmQuestionKey({ id, note: "  Piège classique  " }),
    ).toEqual({ success: true })
    expect(await inToVerify(id)).toBe(false)
    expect((await getQuestionById(id))?.keyConfirmation).toMatchObject({
      byName: "Admin",
      answerCount: 10,
      note: "Piège classique",
    })

    // 19 réponses : pas encore doublé.
    await answerMany(id, 4, 5)
    expect(await inToVerify(id)).toBe(false)
    // 20 réponses, l'écart persiste : la confirmation tombe.
    await answerMany(id, 0, 1)
    expect(await inToVerify(id)).toBe(true)
  })

  it("une nouvelle confirmation remplace l'ancienne", async () => {
    const id = await newQuestion()
    await answerMany(id, 4, 6)
    await confirmQuestionKey({ id, note: "Première" })
    await answerMany(id, 4, 6)

    await confirmQuestionKey({ id })
    expect((await getQuestionById(id))?.keyConfirmation).toMatchObject({
      answerCount: 20,
      note: null,
    })
    expect(await inToVerify(id)).toBe(false)
  })

  it.each([
    ["l'énoncé", { question: "Clé reformulée" }],
    ["les options", { options: ["A", "B", "C", "D2"] }],
    ["la clé", { correctAnswer: "C" }],
  ])("modifier %s efface la confirmation", async (_, change) => {
    const id = await newQuestion()
    await answerMany(id, 4, 6)
    await confirmQuestionKey({ id })

    expect(await updateQuestion({ ...base, id, ...change })).toEqual({
      success: true,
    })
    expect((await getQuestionById(id))?.keyConfirmation).toBeNull()
  })

  it("jumeau : modifier l'explication ou le classement garde la confirmation", async () => {
    const id = await newQuestion()
    await answerMany(id, 4, 6)
    await confirmQuestionKey({ id })

    await updateQuestion({
      ...base,
      id,
      explanation: "Autre explication.",
      objectiveId: await objectiveIdFor("Autre objectif"),
    })
    expect((await getQuestionById(id))?.keyConfirmation).not.toBeNull()
  })

  it("un énoncé hérité à espaces de bord ne fait pas tomber la confirmation", async () => {
    const id = await newQuestion()
    await db
      .update(questions)
      .set({ question: `  ${base.question} ` })
      .where(eq(questions.id, id))
    await answerMany(id, 4, 6)
    await confirmQuestionKey({ id })

    await updateQuestion({ ...base, id, explanation: "Autre explication." })
    expect((await getQuestionById(id))?.keyConfirmation).not.toBeNull()
  })

  it("ne touche pas à la date de modification", async () => {
    const id = await newQuestion()
    await answerMany(id, 4, 6)
    const before = (await getQuestionById(id))?.updatedAt
    await confirmQuestionKey({ id })
    expect((await getQuestionById(id))?.updatedAt).toBe(before)
  })

  it("refusée si la répartition ne désigne pas d'autre option", async () => {
    const id = await newQuestion()
    await answerMany(id, 7, 3)
    expect(await confirmQuestionKey({ id })).toMatchObject({ success: false })
    expect((await getQuestionById(id))?.keyConfirmation).toBeNull()
  })

  it("refusée à un non-admin", async () => {
    const id = await newQuestion()
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("NEXT_REDIRECT"))
    await expect(confirmQuestionKey({ id })).rejects.toThrow("NEXT_REDIRECT")
  })

  it("refuse une note de plus de 500 caractères", async () => {
    const id = await newQuestion()
    await answerMany(id, 4, 6)
    expect(
      await confirmQuestionKey({ id, note: "x".repeat(501) }),
    ).toMatchObject({ success: false })
  })
})

describe("choix figés", () => {
  const future = () => new Date(Date.now() + 7 * 86_400_000)

  it("un examen ouvert refuse un changement de clé ou de choix", async () => {
    const id = await newQuestion()
    await mkExam(id, future())

    const key = await updateQuestion({ ...base, id, correctAnswer: "B" })
    expect(key).toMatchObject({ success: false })
    expect(key.error).toContain("examen ouvert « Examen »")
    expect(
      await updateQuestion({ ...base, id, options: ["A", "B", "C", "D bis"] }),
    ).toMatchObject({ success: false })
    expect(
      await updateQuestion({ ...base, id, options: ["B", "A", "C", "D"] }),
    ).toMatchObject({ success: false })

    const stored = await getQuestionById(id)
    expect(stored?.correctAnswer).toBe("A")
    expect(stored?.options).toEqual(["A", "B", "C", "D"])
  })

  it("accepte l'énoncé, l'explication, les références et le classement", async () => {
    const id = await newQuestion()
    await mkExam(id, future())

    expect(
      await updateQuestion({
        ...base,
        id,
        question: "Énoncé revu",
        explanation: "Explication revue.",
        references: ["R1", "R2"],
        objectiveId: await objectiveIdFor("Objectif revu"),
        domain: "Neurologie",
      }),
    ).toEqual({ success: true })
    expect(await getQuestionById(id)).toMatchObject({
      question: "Énoncé revu",
      explanation: "Explication revue.",
      references: ["R1", "R2"],
      domain: "Neurologie",
    })
  })

  it("jumeau : un examen clos ne fige rien", async () => {
    const id = await newQuestion()
    await mkExam(id, new Date(Date.now() - 3600_000))
    expect(await updateQuestion({ ...base, id, correctAnswer: "B" })).toEqual({
      success: true,
    })
  })
})

describe("nombre de choix", () => {
  it.each([
    [3, false],
    [4, true],
    [5, true],
    [6, false],
  ])("%i choix : accepté = %s", async (n, accepted) => {
    const options = ["A", "B", "C", "D", "E", "F"].slice(0, n)
    const res = await createQuestion({ ...base, options })
    expect(res.success).toBe(accepted)
  })
})

describe("images avant la création", () => {
  beforeEach(() => {
    vi.mocked(createPresignedUpload).mockResolvedValue({
      url: "https://s3.test/upload",
      fields: { key: "k" },
    } as never)
  })

  it("une image envoyée sous l'identifiant réservé est rattachée à la question créée", async () => {
    const reserved = createId()
    const presign = await createQuestionImageUpload({
      questionId: reserved,
      kind: "statement",
      imageIndex: 0,
      contentType: "image/png",
      size: 1000,
    })
    if (!presign.success) throw new Error(presign.error)
    expect(presign.storagePath).toContain(reserved)

    const created = await createQuestion({ ...base, id: reserved })
    expect(created).toEqual({ success: true, id: reserved })

    expect(
      await setQuestionImages({
        questionId: reserved,
        kind: "statement",
        images: [{ storagePath: presign.storagePath, order: 0 }],
      }),
    ).toEqual({ success: true })
    const stored = await getQuestionById(reserved)
    expect(stored?.images).toHaveLength(1)
    expect(stored?.images[0].storagePath).toMatch(
      new RegExp(`^questions/${reserved}/`),
    )
  })

  it("une question supprimée ne reçoit plus d'image", async () => {
    const id = await newQuestion()
    await seedAnswers(id, ["A"]) // référencée : archivée, pas supprimée
    expect(await deleteQuestion(id)).toMatchObject({ mode: "soft" })
    expect(
      await createQuestionImageUpload({
        questionId: id,
        imageIndex: 0,
        contentType: "image/png",
        size: 1000,
      }),
    ).toEqual({ success: false, error: "Question introuvable" })
  })

  it("un identifiant déjà pris est refusé", async () => {
    const id = await newQuestion()
    expect(await createQuestion({ ...base, id })).toMatchObject({
      success: false,
    })
    const rows = await db.select().from(questions).where(eq(questions.id, id))
    expect(rows).toHaveLength(1)
  })
})
