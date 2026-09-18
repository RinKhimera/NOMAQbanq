import { eq, inArray, sql } from "drizzle-orm"
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
  type LockViewer,
  excludeLocked,
  lockFor,
} from "@/features/questions/answer-key-lock"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const OTHER_USER_ID = createId()
const OPEN_EXAM_ID = createId()
const CLOSED_EXAM_ID = createId()
// 0-1 = examen ouvert (USER_ID participe) · 2 = examen clos · 3 = hors examen
const qIds = Array.from({ length: 4 }, () => createId())

const asUser: LockViewer = { id: USER_ID, role: "user" }
const asOther: LockViewer = { id: OTHER_USER_ID, role: "user" }
const asAdmin: LockViewer = { id: USER_ID, role: "admin" }

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
    { id: USER_ID, name: "IT verrou", email: `lock-${suffix}@test.invalid` },
    {
      id: OTHER_USER_ID,
      name: "IT verrou autre",
      email: `lock-other-${suffix}@test.invalid`,
    },
  ])
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
  await db.delete(user).where(inArray(user.id, [USER_ID, OTHER_USER_ID]))
})

describe("verrou de clé de réponse — lockFor (révélation)", () => {
  it("participant : verrouille les questions de SON examen ouvert, pas celles d'un examen clos", async () => {
    const lock = await lockFor(asUser, qIds)
    expect(qIds.filter((id) => lock.has(id))).toEqual([qIds[0], qIds[1]])
  })

  it("non-participant : rien n'est verrouillé", async () => {
    const lock = await lockFor(asOther, qIds)
    expect(qIds.some((id) => lock.has(id))).toBe(false)
  })

  it("anonyme : toute question d'un examen ouvert, sans dimension utilisateur", async () => {
    const lock = await lockFor("anonymous", qIds)
    expect(qIds.filter((id) => lock.has(id))).toEqual([qIds[0], qIds[1]])
  })

  it("admin : jamais verrouillé", async () => {
    const lock = await lockFor(asAdmin, qIds)
    expect(qIds.some((id) => lock.has(id))).toBe(false)
  })

  it("borné aux candidates", async () => {
    const lock = await lockFor(asUser, [qIds[0], qIds[3]])
    expect(lock.has(qIds[0])).toBe(true)
    expect(lock.has(qIds[1])).toBe(false)
  })
})

describe("verrou de clé de réponse — excludeLocked (sélection)", () => {
  it("participant : même jeu que lockFor, retranché de la sélection", async () => {
    expect(await selectable(asUser)).toEqual([qIds[2], qIds[3]].sort())
  })

  it("non-participant : rien n'est retranché", async () => {
    expect(await selectable(asOther)).toEqual([...qIds].sort())
  })

  it("anonyme : toute question d'un examen ouvert est retranchée", async () => {
    expect(await selectable("anonymous")).toEqual([qIds[2], qIds[3]].sort())
  })

  it("admin : rien n'est retranché", async () => {
    expect(await selectable(asAdmin)).toEqual([...qIds].sort())
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
