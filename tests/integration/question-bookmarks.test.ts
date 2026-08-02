import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { questionBookmarks, questions, user } from "@/db/schema"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const DOMAIN = `QB-${suffix}`
const qIds = Array.from({ length: 3 }, () => createId())

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT bookmarks",
    email: `qb-${suffix}@test.invalid`,
  })
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `QB Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj QB ${suffix}`,
      domain: DOMAIN,
    })),
  )
})

afterAll(async () => {
  await db
    .delete(questionBookmarks)
    .where(eq(questionBookmarks.userId, USER_ID))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(eq(user.id, USER_ID))
})

describe("table question_bookmarks", () => {
  it("refuse un doublon (utilisateur, question)", async () => {
    await db
      .insert(questionBookmarks)
      .values({ userId: USER_ID, questionId: qIds[0] })

    await expect(
      db.insert(questionBookmarks).values({
        userId: USER_ID,
        questionId: qIds[0],
      }),
    ).rejects.toThrow()
  })

  it("la suppression d'une question emporte ses signets (cascade)", async () => {
    const doomedQuestionId = createId()
    await db.insert(questions).values({
      id: doomedQuestionId,
      question: `QB doomed ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj QB ${suffix}`,
      domain: DOMAIN,
    })
    await db
      .insert(questionBookmarks)
      .values({ userId: USER_ID, questionId: doomedQuestionId })

    await db.delete(questions).where(eq(questions.id, doomedQuestionId))

    const rows = await db
      .select({ id: questionBookmarks.id })
      .from(questionBookmarks)
      .where(eq(questionBookmarks.questionId, doomedQuestionId))
    expect(rows).toHaveLength(0)
  })
})
