import { eq, sql } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import {
  type LockViewer,
  excludeLocked,
  lockFor,
} from "@/features/questions/answer-key-lock"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

const USER_ID = createId()
const OTHER_USER_ID = createId()
const OPEN_EXAM_ID = createId()
const CLOSED_EXAM_ID = createId()
// 0-1 = examen ouvert (USER_ID participe) · 2 = examen clos · 3 = hors examen
const qIds = Array.from({ length: 4 }, () => createId())

const asUser: LockViewer = { id: USER_ID, role: "user" }
const asOther: LockViewer = { id: OTHER_USER_ID, role: "user" }

/** Ids du jeu de test qui SURVIVENT au prédicat de sélection. */
const selectable = async (viewer: LockViewer): Promise<string[]> => {
  const res = await db.execute(sql`
    select q.id from questions q
     where q.id in (${sql.join(
       qIds.map((id) => sql`${id}`),
       sql`, `,
     )})
       and ${excludeLocked(viewer, sql`q.id`)}
  `)
  return res.rows.map((r) => String(r.id)).sort()
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: USER_ID, name: "IT verrou", email: "lock@test.invalid" },
    {
      id: OTHER_USER_ID,
      name: "IT verrou autre",
      email: "lock-other@test.invalid",
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `LOCK Q${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "LOCK",
    })),
  )
  await db.insert(exams).values([
    {
      id: OPEN_EXAM_ID,
      title: "LOCK ouvert",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2099-01-01T00:00:00Z"),
      completionTime: 3600,
      createdBy: USER_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    },
    {
      id: CLOSED_EXAM_ID,
      title: "LOCK clos",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-02T00:00:00Z"),
      completionTime: 3600,
      createdBy: USER_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
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

// Les deux entrées du verrou lisent la même règle : ce que `lockFor` retient,
// `excludeLocked` le retranche de la sélection. Le cas admin, court-circuit
// JS sans requête, est prouvé en unitaire (`tests/questions/answer-key-lock.test.ts`).
describe.each<[string, LockViewer, number[]]>([
  [
    "participant : les questions de SON examen ouvert, pas d'un examen clos",
    asUser,
    [0, 1],
  ],
  ["non-participant : rien", asOther, []],
  ["anonyme : toute question d'un examen ouvert", "anonymous", [0, 1]],
])("verrou de clé de réponse — %s", (_, viewer, lockedIdx) => {
  const locked = lockedIdx.map((i) => qIds[i])

  it("lockFor retient exactement ces questions", async () => {
    const lock = await lockFor(viewer, qIds)
    expect(qIds.filter((id) => lock.has(id))).toEqual(locked)
  })

  it("excludeLocked les retranche de la sélection", async () => {
    expect(await selectable(viewer)).toEqual(
      qIds.filter((id) => !locked.includes(id)).sort(),
    )
  })
})

describe("verrou de clé de réponse — bornes", () => {
  it("lockFor est borné aux candidates", async () => {
    const lock = await lockFor(asUser, [qIds[0], qIds[3]])
    expect(lock.has(qIds[0])).toBe(true)
    expect(lock.has(qIds[1])).toBe(false)
  })

  it("un examen qui vient de se clore libère ses questions", async () => {
    await db
      .update(exams)
      .set({ endDate: new Date("2026-01-03T00:00:00Z") })
      .where(eq(exams.id, OPEN_EXAM_ID))
    try {
      expect(await selectable(asUser)).toEqual([...qIds].sort())
      const lock = await lockFor(asUser, qIds)
      expect(qIds.some((id) => lock.has(id))).toBe(false)
    } finally {
      await db
        .update(exams)
        .set({ endDate: new Date("2099-01-01T00:00:00Z") })
        .where(eq(exams.id, OPEN_EXAM_ID))
    }
  })
})
