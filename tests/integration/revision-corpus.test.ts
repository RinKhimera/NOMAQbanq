import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  questionBookmarks,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import {
  getRevisionCounts,
  pickRevisionQuestionIds,
} from "@/features/training/revision"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const OTHER_USER_ID = createId()
const DOMAIN = `RC-${suffix}`
const OBJ = `Obj RC ${suffix}`
// Deuxième objectif, porté par la seule question d'index 4 : exerce la branche
// « filtre objectifs » du SQL brut, qu'aucun autre test ne traverse.
const OBJ_ALT = `Obj RC alt ${suffix}`

// 0 = ratée · 1 = ratée puis réussie · 2 = réussie · 3 = marquée (jamais vue)
// 4 = jamais vue (objectif alternatif) · 5 = ratée par l'AUTRE utilisateur
const qIds = Array.from({ length: 6 }, () => createId())
const SESSION_ID = createId()
const OTHER_SESSION_ID = createId()

const seedSession = async (
  sessionId: string,
  userId: string,
  items: { questionId: string; isCorrect: boolean; answeredAt: Date }[],
) => {
  await db.insert(trainingSessions).values({
    id: sessionId,
    userId,
    status: "completed",
    mode: "test",
    questionCount: items.length,
    startedAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2026-01-02T00:00:00Z"),
  })
  await db.insert(trainingSessionItems).values(
    items.map((it, position) => ({
      sessionId,
      questionId: it.questionId,
      position,
      selectedAnswer: it.isCorrect ? "A" : "B",
      isCorrect: it.isCorrect,
      answeredAt: it.answeredAt,
    })),
  )
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: USER_ID, name: "IT revision", email: `rc-${suffix}@test.invalid` },
    {
      id: OTHER_USER_ID,
      name: "IT revision autre",
      email: `rc-other-${suffix}@test.invalid`,
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `RC Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: i === 4 ? OBJ_ALT : OBJ,
      domain: DOMAIN,
    })),
  )

  await seedSession(SESSION_ID, USER_ID, [
    {
      questionId: qIds[0],
      isCorrect: false,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
    {
      questionId: qIds[1],
      isCorrect: false,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
    {
      questionId: qIds[2],
      isCorrect: true,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
  ])
  // Reprise plus tardive de q1 : réussie → elle doit SORTIR des ratées.
  await seedSession(createId(), USER_ID, [
    {
      questionId: qIds[1],
      isCorrect: true,
      answeredAt: new Date("2026-01-05T10:00:00Z"),
    },
  ])
  await seedSession(OTHER_SESSION_ID, OTHER_USER_ID, [
    {
      questionId: qIds[5],
      isCorrect: false,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
  ])

  await db
    .insert(questionBookmarks)
    .values({ userId: USER_ID, questionId: qIds[3] })
})

afterAll(async () => {
  await db
    .delete(questionBookmarks)
    .where(eq(questionBookmarks.userId, USER_ID))
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.userId, [USER_ID, OTHER_USER_ID]))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(inArray(user.id, [USER_ID, OTHER_USER_ID]))
})

describe("corpus de révision", () => {
  it("« ratée » = dernière tentative fausse (une réussite ultérieure la retire)", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["failed"],
      domain: DOMAIN,
      limit: 20,
    })
    expect(ids).toEqual([qIds[0]])
  })

  it("« non vue » = jamais répondue", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["unseen"],
      domain: DOMAIN,
      limit: 20,
    })
    expect([...ids].sort()).toEqual([qIds[3], qIds[4], qIds[5]].sort())
  })

  it("les critères s'unissent en OU", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["failed", "bookmarked"],
      domain: DOMAIN,
      limit: 20,
    })
    expect([...ids].sort()).toEqual([qIds[0], qIds[3]].sort())
  })

  it("borne le tirage à la limite demandée", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["unseen"],
      domain: DOMAIN,
      limit: 2,
    })
    expect(ids).toHaveLength(2)
  })

  it("n'emprunte jamais l'historique d'un autre étudiant", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["failed"],
      domain: DOMAIN,
      limit: 20,
    })
    expect(ids).not.toContain(qIds[5])
  })

  it("une question servie mais jamais répondue reste « non vue »", async () => {
    // Session abandonnée : l'item existe, `selected_answer` est nul.
    const orphanSessionId = createId()
    await db.insert(trainingSessions).values({
      id: orphanSessionId,
      userId: USER_ID,
      status: "abandoned",
      mode: "test",
      questionCount: 1,
      startedAt: new Date("2026-01-03T00:00:00Z"),
      expiresAt: new Date("2026-01-04T00:00:00Z"),
    })
    await db.insert(trainingSessionItems).values({
      sessionId: orphanSessionId,
      questionId: qIds[4],
      position: 0,
    })

    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["unseen"],
      domain: DOMAIN,
      limit: 20,
    })
    expect(ids).toContain(qIds[4])
  })

  it("intersecte avec le filtre d'objectifs CMC", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["unseen"],
      domain: DOMAIN,
      objectifsCMCs: [OBJ_ALT],
      limit: 20,
    })
    expect(ids).toEqual([qIds[4]])

    const counts = await getRevisionCounts(USER_ID, {
      domain: DOMAIN,
      objectifsCMCs: [OBJ_ALT],
    })
    expect(counts.unseen).toBe(1)
  })

  it("les compteurs décrivent le même corpus que le tirage", async () => {
    const counts = await getRevisionCounts(USER_ID, { domain: DOMAIN })
    expect(counts).toEqual({ failed: 1, unseen: 3, bookmarked: 1 })
  })
})
