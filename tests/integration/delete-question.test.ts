import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionImages,
  questions,
  user,
} from "@/db/schema"
import { deleteQuestion } from "@/features/questions/actions"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { tryDeleteFromStorage } from "@/lib/storage"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

vi.mock("@/lib/auth-guards", () => ({ requireRole: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
// S3 jamais touché par les tests : on stubbe la suppression best-effort.
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
}))

const adminId = createId()
const examId = createId()
const DAY = 24 * 60 * 60 * 1000
let examPosition = 0

/** Une question avec son image ; `inExam` la rend référencée par un examen. */
const seedQuestion = async ({ inExam }: { inExam: boolean }) => {
  const id = createId()
  await db.insert(questions).values({
    id,
    question: "Question ?",
    correctAnswer: "A",
    options: ["A", "B"],
    objectiveId: TEST_OBJECTIVE_ID,
    domain: "Cardiologie",
  })
  await db.insert(questionImages).values({
    questionId: id,
    storagePath: `questions/${id}/1-0.jpg`,
    position: 0,
    kind: "statement",
  })
  if (inExam)
    await db
      .insert(examQuestions)
      .values({ examId, questionId: id, position: examPosition++ })
  return id
}

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, role: "admin" },
  } as never)

  await db.insert(user).values({
    id: adminId,
    name: "Admin Test",
    email: `${adminId}@test.invalid`,
  })
  const now = Date.now()
  await db.insert(exams).values({
    id: examId,
    title: "Examen",
    startDate: new Date(now - DAY),
    endDate: new Date(now + DAY),
    completionTime: 3600,
    createdBy: adminId,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
})

describe("deleteQuestion (hybride hard/soft)", () => {
  it("hard delete + purge S3 quand la question n'est référencée nulle part", async () => {
    const qFree = await seedQuestion({ inExam: false })
    vi.mocked(tryDeleteFromStorage).mockClear()
    const res = await deleteQuestion(qFree)
    expect(res).toEqual({ success: true, mode: "hard" })

    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, qFree))
    expect(rows).toHaveLength(0)
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith(
      `questions/${qFree}/1-0.jpg`,
    )
  })

  it("soft delete quand la question est référencée — médias DB et S3 conservés", async () => {
    const qUsed = await seedQuestion({ inExam: true })
    vi.mocked(tryDeleteFromStorage).mockClear()
    const res = await deleteQuestion(qUsed)
    expect(res).toEqual({ success: true, mode: "soft" })

    const [row] = await db
      .select({ deletedAt: questions.deletedAt })
      .from(questions)
      .where(eq(questions.id, qUsed))
    expect(row?.deletedAt).not.toBeNull()

    const imgs = await db
      .select({ id: questionImages.id })
      .from(questionImages)
      .where(eq(questionImages.questionId, qUsed))
    expect(imgs).toHaveLength(1)
    expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalled()
  })

  it("échoue proprement sur une question inexistante ou déjà supprimée", async () => {
    const notFound = { success: false, error: "Question introuvable" }
    expect(await deleteQuestion(createId())).toEqual(notFound)

    const archived = await seedQuestion({ inExam: true })
    const deletedAt = new Date(Date.UTC(2020, 0, 1))
    await db
      .update(questions)
      .set({ deletedAt })
      .where(eq(questions.id, archived))
    expect(await deleteQuestion(archived)).toEqual(notFound)
    const [row] = await db
      .select({ deletedAt: questions.deletedAt })
      .from(questions)
      .where(eq(questions.id, archived))
    expect(row?.deletedAt).toEqual(deletedAt)
  })
})
