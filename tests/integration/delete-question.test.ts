import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
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

vi.mock("@/lib/auth-guards", () => ({ requireRole: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// S3 jamais touché par les tests : on stubbe la suppression best-effort.
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
}))

const adminId = createId()
const qFree = createId() // jamais référencée → hard delete attendu
const qUsed = createId() // référencée par un examen → soft delete attendu
const examId = createId()
const DAY = 24 * 60 * 60 * 1000

const mkQuestion = (id: string, label: string) => ({
  id,
  question: `Question ${label} ?`,
  correctAnswer: "A",
  options: ["A", "B"],
  objectifCmc: "Objectif IT",
  domain: "Cardiologie",
})

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, role: "admin" },
  } as never)

  await db.insert(user).values({
    id: adminId,
    name: "Admin Test",
    email: `${adminId}@test.invalid`,
  })
  await db
    .insert(questions)
    .values([mkQuestion(qFree, "libre"), mkQuestion(qUsed, "utilisée")])
  await db.insert(questionImages).values([
    {
      questionId: qFree,
      storagePath: `questions/${qFree}/1-0.jpg`,
      position: 0,
      kind: "statement" as const,
    },
    {
      questionId: qUsed,
      storagePath: `questions/${qUsed}/1-0.jpg`,
      position: 0,
      kind: "statement" as const,
    },
  ])
  const now = Date.now()
  await db.insert(exams).values({
    id: examId,
    title: "[IT] delete-question",
    startDate: new Date(now - DAY),
    endDate: new Date(now + DAY),
    completionTime: 3600,
    createdBy: adminId,
  })
  await db
    .insert(examQuestions)
    .values({ examId, questionId: qUsed, position: 0 })
})

afterAll(async () => {
  // Enfants avant parents (FK restrict).
  await db.delete(examQuestions).where(eq(examQuestions.examId, examId))
  await db.delete(exams).where(eq(exams.id, examId))
  await db.delete(questions).where(eq(questions.id, qUsed)) // cascade images
  await db.delete(questions).where(eq(questions.id, qFree)) // no-op si hard OK
  await db.delete(user).where(eq(user.id, adminId))
})

describe("deleteQuestion (hybride hard/soft)", () => {
  it("hard delete + purge S3 quand la question n'est référencée nulle part", async () => {
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
    const res = await deleteQuestion(createId())
    expect(res.success).toBe(false)

    const again = await deleteQuestion(qUsed) // déjà soft-deleted
    expect(again.success).toBe(false)
  })
})
