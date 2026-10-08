import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { questionBookmarks, questions, user } from "@/db/schema"
import { setQuestionBookmark } from "@/features/training/actions"
import { getBookmarkedQuestionIds } from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const signInAs = (id: string) =>
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id, role: "user" },
  } as never)

/** Nouvel étudiant, connecté pour la suite du test. */
const signInNewStudent = async () => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: "IT bookmarks", email: `qb-${id}@test.invalid` })
  signInAs(id)
  return id
}

const seedQuestion = async () => {
  const id = createId()
  await db.insert(questions).values({
    id,
    question: "Question à mettre en signet ?",
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectiveId: TEST_OBJECTIVE_ID,
    domain: "Cardiologie",
  })
  return id
}

describe("table question_bookmarks", () => {
  it("refuse un doublon (utilisateur, question)", async () => {
    const userId = await signInNewStudent()
    const questionId = await seedQuestion()
    await db.insert(questionBookmarks).values({ userId, questionId })

    await expect(
      db.insert(questionBookmarks).values({ userId, questionId }),
    ).rejects.toMatchObject({ cause: { code: "23505" } })
  })

  it("la suppression d'une question emporte ses signets (cascade)", async () => {
    const userId = await signInNewStudent()
    const doomedQuestionId = await seedQuestion()
    await db
      .insert(questionBookmarks)
      .values({ userId, questionId: doomedQuestionId })

    await db.delete(questions).where(eq(questions.id, doomedQuestionId))

    const rows = await db
      .select({ id: questionBookmarks.id })
      .from(questionBookmarks)
      .where(eq(questionBookmarks.questionId, doomedQuestionId))
    expect(rows).toHaveLength(0)
  })
})

describe("setQuestionBookmark", () => {
  it("pose le signet, puis le retire", async () => {
    await signInNewStudent()
    const questionId = await seedQuestion()
    const posed = await setQuestionBookmark({ questionId, isBookmarked: true })
    expect(posed.success).toBe(true)
    expect(await getBookmarkedQuestionIds([questionId])).toEqual([questionId])

    const removed = await setQuestionBookmark({
      questionId,
      isBookmarked: false,
    })
    expect(removed.success).toBe(true)
    expect(await getBookmarkedQuestionIds([questionId])).toEqual([])
  })

  it("est idempotente : deux poses successives ne cassent rien", async () => {
    await signInNewStudent()
    const questionId = await seedQuestion()
    await setQuestionBookmark({ questionId, isBookmarked: true })
    const again = await setQuestionBookmark({ questionId, isBookmarked: true })
    expect(again.success).toBe(true)
    expect(await getBookmarkedQuestionIds([questionId])).toEqual([questionId])
  })

  it("ne lit jamais les signets d'un autre étudiant", async () => {
    await signInNewStudent()
    const questionId = await seedQuestion()
    await setQuestionBookmark({ questionId, isBookmarked: true })
    expect(await getBookmarkedQuestionIds([questionId])).toEqual([questionId])

    await signInNewStudent()
    expect(await getBookmarkedQuestionIds([questionId])).toEqual([])
  })

  it("refuse proprement une question inexistante", async () => {
    await signInNewStudent()
    const res = await setQuestionBookmark({
      questionId: "question-qui-n-existe-pas",
      isBookmarked: true,
    })
    expect(res.success).toBe(false)
    expect(res.error).toBe("Question introuvable.")
  })
})
