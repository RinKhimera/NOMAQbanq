import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { questionBookmarks, questions, user } from "@/db/schema"
import { setQuestionBookmark } from "@/features/training/actions"
import { getBookmarkedQuestionIds } from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const asOwner = () =>
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id: USER_ID, role: "admin" },
  } as never)

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
  asOwner()
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

describe("setQuestionBookmark", () => {
  it("pose le signet, puis le retire", async () => {
    asOwner()
    const posed = await setQuestionBookmark({
      questionId: qIds[1],
      isBookmarked: true,
    })
    expect(posed.success).toBe(true)
    expect(await getBookmarkedQuestionIds([qIds[1]])).toEqual([qIds[1]])

    const removed = await setQuestionBookmark({
      questionId: qIds[1],
      isBookmarked: false,
    })
    expect(removed.success).toBe(true)
    expect(await getBookmarkedQuestionIds([qIds[1]])).toEqual([])
  })

  it("est idempotente : deux poses successives ne cassent rien", async () => {
    asOwner()
    await setQuestionBookmark({ questionId: qIds[2], isBookmarked: true })
    const again = await setQuestionBookmark({
      questionId: qIds[2],
      isBookmarked: true,
    })
    expect(again.success).toBe(true)
    expect(await getBookmarkedQuestionIds([qIds[2]])).toEqual([qIds[2]])
  })

  it("ne lit jamais les signets d'un autre étudiant", async () => {
    asOwner()
    await setQuestionBookmark({ questionId: qIds[0], isBookmarked: true })

    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: createId(), role: "user" },
    } as never)
    expect(await getBookmarkedQuestionIds([qIds[0]])).toEqual([])

    asOwner()
  })

  it("refuse proprement une question inexistante", async () => {
    asOwner()
    const res = await setQuestionBookmark({
      questionId: "question-qui-n-existe-pas",
      isBookmarked: true,
    })
    expect(res.success).toBe(false)
    expect(res.error).toBe("Question introuvable.")
  })
})
