import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionImages,
  questions,
  user,
} from "@/db/schema"
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
import { copyInS3, createPresignedUpload } from "@/lib/aws"
import { formatDeadline } from "@/lib/format"
import { createId } from "@/lib/ids"
import { tryDeleteFromStorage } from "@/lib/storage"
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

/** Examen contenant la question ; fenêtre en ms relatives à maintenant. */
const mkExam = async (
  questionId: string,
  window: { start: number; end: number },
  title = "Examen",
  finalized = true,
) => {
  const id = createId()
  const endDate = new Date(Date.now() + window.end)
  await db.insert(exams).values({
    id,
    title,
    startDate: new Date(Date.now() + window.start),
    endDate,
    completionTime: 3600,
    createdBy: adminId,
    targetQuestionCount: 10,
    finalizedAt: finalized ? new Date() : null,
  })
  await db.insert(examQuestions).values({ examId: id, questionId, position: 0 })
  return endDate
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

describe("question figée", () => {
  const DAY = 86_400_000
  const inProgress = { start: -DAY, end: 7 * DAY }
  const upcoming = { start: 2 * DAY, end: 9 * DAY }

  const statementImages = (id: string, ...names: string[]) =>
    setQuestionImages({
      questionId: id,
      kind: "statement",
      images: names.map((n, order) => ({
        storagePath: `questions/${id}/${n}.jpg`,
        order,
      })),
    })

  it("un examen en cours refuse un changement d'énoncé, de clé ou de choix, en le nommant", async () => {
    const id = await newQuestion()
    const end = await mkExam(id, inProgress, "Examen d'automne")

    const key = await updateQuestion({ ...base, id, correctAnswer: "B" })
    expect(key).toMatchObject({ success: false })
    expect(key.error).toContain("« Examen d'automne »")
    expect(key.error).toContain(`jusqu'au ${formatDeadline(end)}`)
    for (const change of [
      { options: ["A", "B", "C", "D bis"] },
      { options: ["B", "A", "C", "D"] },
      { question: "Énoncé revu" },
    ]) {
      expect(await updateQuestion({ ...base, id, ...change })).toMatchObject({
        success: false,
      })
    }

    expect(await getQuestionById(id)).toMatchObject({
      question: "Clé",
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
    })
  })

  it("un examen en cours suspendu fige aussi : seules ses dates comptent", async () => {
    const id = await newQuestion()
    await mkExam(id, inProgress, "Suspendu")
    await db
      .update(exams)
      .set({ isActive: false })
      .where(eq(exams.title, "Suspendu"))

    const res = await updateQuestion({ ...base, id, correctAnswer: "B" })
    expect(res.error).toContain("« Suspendu »")
  })

  it("nomme l'examen en cours qui ferme le plus tard", async () => {
    const id = await newQuestion()
    await mkExam(id, inProgress, "Ferme tôt")
    await mkExam(id, { start: -DAY, end: 20 * DAY }, "Ferme tard")
    await mkExam(id, { start: 3 * DAY, end: 30 * DAY }, "À venir")

    const res = await updateQuestion({ ...base, id, correctAnswer: "B" })
    expect(res.error).toContain("« Ferme tard »")
  })

  it("jumeau : l'explication, les références et le classement restent modifiables", async () => {
    const id = await newQuestion()
    await mkExam(id, inProgress)

    expect(
      await updateQuestion({
        ...base,
        id,
        explanation: "Explication revue.",
        references: ["R1", "R2"],
        objectiveId: await objectiveIdFor("Objectif revu"),
        domain: "Neurologie",
      }),
    ).toEqual({ success: true })
    expect(await getQuestionById(id)).toMatchObject({
      explanation: "Explication revue.",
      references: ["R1", "R2"],
      domain: "Neurologie",
    })
  })

  it("un énoncé identique aux espaces de bord près n'est pas un changement", async () => {
    const id = await newQuestion()
    await db
      .update(questions)
      .set({ question: "  Clé  " })
      .where(eq(questions.id, id))
    await mkExam(id, inProgress)

    expect(await updateQuestion({ ...base, id })).toEqual({ success: true })
  })

  it("un examen en cours refuse les images d'énoncé, pas celles d'explication", async () => {
    const id = await newQuestion()
    expect(await statementImages(id, "a")).toEqual({ success: true })
    await mkExam(id, inProgress, "Examen d'automne")

    const refused = await statementImages(id, "a", "b")
    expect(refused).toMatchObject({ success: false })
    expect(refused.error).toContain("« Examen d'automne »")
    expect(await statementImages(id)).toMatchObject({ success: false })
    expect((await getQuestionById(id))?.images).toHaveLength(1)

    // Le formulaire réécrit les deux jeux à chaque enregistrement.
    expect(await statementImages(id, "a")).toEqual({ success: true })
    expect(
      await setQuestionImages({
        questionId: id,
        kind: "explanation",
        images: [{ storagePath: `questions/${id}/expl.jpg`, order: 0 }],
      }),
    ).toEqual({ success: true })
  })

  it("des positions stockées à trous ne font pas d'un jeu réécrit un changement", async () => {
    const id = await newQuestion()
    await db.insert(questionImages).values(
      [3, 7].map((position, i) => ({
        questionId: id,
        kind: "statement" as const,
        storagePath: `questions/${id}/${"ab"[i]}.jpg`,
        position,
      })),
    )
    await mkExam(id, inProgress)

    expect(await statementImages(id, "a", "b")).toEqual({ success: true })
    expect(await statementImages(id, "b", "a")).toMatchObject({
      success: false,
    })
  })

  it("des positions ex æquo se relisent dans le même ordre que le formulaire", async () => {
    const id = await newQuestion()
    await db.insert(questionImages).values(
      ["z", "y", "x"].map((n, i) => ({
        id: `${n}${i}-${id}`,
        questionId: id,
        kind: "statement" as const,
        storagePath: `questions/${id}/${n}.jpg`,
        position: 0,
      })),
    )
    await mkExam(id, inProgress)

    const shown = (await getQuestionById(id))?.images ?? []
    expect(shown.map((i) => i.storagePath)).toEqual(
      ["x", "y", "z"].map((n) => `questions/${id}/${n}.jpg`),
    )
    expect(
      await setQuestionImages({
        questionId: id,
        kind: "statement",
        images: shown.map((i, order) => ({
          storagePath: i.storagePath,
          order,
        })),
      }),
    ).toEqual({ success: true })
  })

  it("un chemin temporaire déjà enregistré n'est ni recopié ni supprimé par un refus", async () => {
    const id = await newQuestion()
    const tmp = (n: string) => `tmp/questions/${id}/statement/${n}.jpg`
    const send = (...names: string[]) =>
      setQuestionImages({
        questionId: id,
        kind: "statement",
        images: names.map((n, order) => ({ storagePath: tmp(n), order })),
      })
    expect(await send("a")).toEqual({ success: true })
    await mkExam(id, inProgress)
    vi.mocked(copyInS3).mockClear()
    vi.mocked(tryDeleteFromStorage).mockClear()

    // Le formulaire garde ses chemins temporaires après un refus partiel.
    expect(await send("a")).toEqual({ success: true })
    expect(copyInS3).not.toHaveBeenCalled()

    expect(await send("a", "b")).toMatchObject({ success: false })
    expect(copyInS3).toHaveBeenCalledExactlyOnceWith(
      tmp("b"),
      `questions/${id}/statement/b.jpg`,
    )
    expect(tryDeleteFromStorage).toHaveBeenCalledWith(
      `questions/${id}/statement/b.jpg`,
    )
    expect(tryDeleteFromStorage).not.toHaveBeenCalledWith(
      `questions/${id}/statement/a.jpg`,
    )
    expect((await getQuestionById(id))?.images).toHaveLength(1)
  })

  it("jumeau : un examen à venir ne fige rien", async () => {
    const id = await newQuestion()
    await mkExam(id, upcoming)

    expect(
      await updateQuestion({
        ...base,
        id,
        question: "Énoncé revu",
        options: ["A", "B", "C", "D bis"],
        correctAnswer: "B",
      }),
    ).toEqual({ success: true })
    expect(await statementImages(id, "a")).toEqual({ success: true })
  })

  it.each([
    ["clos", { start: -2 * DAY, end: -3600_000 }, true],
    ["en préparation", inProgress, false],
  ])("jumeau : un examen %s ne fige rien", async (_, window, finalized) => {
    const id = await newQuestion()
    await mkExam(id, window, "Examen", finalized)
    expect(
      await updateQuestion({
        ...base,
        id,
        question: "Énoncé revu",
        correctAnswer: "B",
      }),
    ).toEqual({ success: true })
    expect(await statementImages(id, "a")).toEqual({ success: true })
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
