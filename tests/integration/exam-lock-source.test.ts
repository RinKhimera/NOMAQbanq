import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import {
  getOpenExamLockedQuestionIds,
  getUserOpenExamLockedQuestionIds,
} from "@/features/exams/dal.shared"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const OPEN_EXAM_ID = createId()
const CLOSED_EXAM_ID = createId()
// 0-1 = examen ouvert · 2 = examen clos · 3 = hors examen
const qIds = Array.from({ length: 4 }, () => createId())

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT verrou",
    email: `lock-${suffix}@test.invalid`,
  })
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `LOCK Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj LOCK ${suffix}`,
      domain: `LOCK-${suffix}`,
    })),
  )
  await db.insert(exams).values([
    {
      id: OPEN_EXAM_ID,
      title: `LOCK ouvert ${suffix}`,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2099-01-01T00:00:00Z"),
      completionTime: 3600,
      createdBy: USER_ID,
    },
    {
      id: CLOSED_EXAM_ID,
      title: `LOCK clos ${suffix}`,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-02T00:00:00Z"),
      completionTime: 3600,
      createdBy: USER_ID,
    },
  ])
  await db.insert(examQuestions).values([
    { examId: OPEN_EXAM_ID, questionId: qIds[0], position: 0 },
    { examId: OPEN_EXAM_ID, questionId: qIds[1], position: 1 },
    { examId: CLOSED_EXAM_ID, questionId: qIds[2], position: 0 },
  ])
  await db.insert(examParticipations).values([
    {
      id: createId(),
      examId: OPEN_EXAM_ID,
      userId: USER_ID,
      status: "in_progress",
      startedAt: new Date("2026-01-01T01:00:00Z"),
    },
    {
      id: createId(),
      examId: CLOSED_EXAM_ID,
      userId: USER_ID,
      status: "completed",
      startedAt: new Date("2026-01-01T01:00:00Z"),
    },
  ])
})

afterAll(async () => {
  await db
    .delete(examParticipations)
    .where(inArray(examParticipations.examId, [OPEN_EXAM_ID, CLOSED_EXAM_ID]))
  await db
    .delete(examQuestions)
    .where(inArray(examQuestions.examId, [OPEN_EXAM_ID, CLOSED_EXAM_ID]))
  await db
    .delete(exams)
    .where(inArray(exams.id, [OPEN_EXAM_ID, CLOSED_EXAM_ID]))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(eq(user.id, USER_ID))
})

describe("verrou anti-triche — source unique", () => {
  it("le jeu complet ne dépend d'aucune liste de candidats", async () => {
    const all = await getUserOpenExamLockedQuestionIds(USER_ID)

    expect(all.has(qIds[0])).toBe(true)
    expect(all.has(qIds[1])).toBe(true)
    expect(all.has(qIds[2])).toBe(false) // examen clos
    expect(all.has(qIds[3])).toBe(false) // hors examen
  })

  it("la version restreinte est un sous-ensemble du jeu complet", async () => {
    const all = await getUserOpenExamLockedQuestionIds(USER_ID)
    const narrowed = await getOpenExamLockedQuestionIds(USER_ID, [
      qIds[0],
      qIds[3],
    ])

    expect([...narrowed]).toEqual([qIds[0]])
    for (const id of narrowed) expect(all.has(id)).toBe(true)
  })
})
