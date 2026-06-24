import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

import { closeExpiredExamParticipations } from "@/features/exams/cron"
import { closeExpiredTrainingSessions } from "@/features/training/cron"

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)

const U1 = createId() // in_progress expiré → fermé
const U2 = createId() // in_progress non expiré → intact
const U3 = createId() // déjà terminé → intact
const USERS = [U1, U2, U3]
const qIds = Array.from({ length: 4 }, () => createId())

const examPast = createId()
const examFuture = createId()
const pPast = createId()
const pFuture = createId()
const pDone = createId()

const tsExpired = createId()
const tsFuture = createId()
const tsDone = createId()

beforeAll(async () => {
  const now = Date.now()
  await db.insert(user).values(
    USERS.map((id, i) => ({
      id,
      name: `Cron ${suffix} ${i}`,
      email: `${id.slice(0, 6)}-${suffix}@test.invalid`,
    })),
  )
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q ${i} ${suffix} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj ${suffix}`,
      domain: `CRON-${suffix}`,
    })),
  )

  const mkExam = (id: string, endOffset: number) => ({
    id,
    title: `Exam ${suffix} ${id.slice(0, 4)}`,
    startDate: new Date(now - 3 * DAY),
    endDate: new Date(now + endOffset),
    completionTime: 3600,
    isActive: true,
    createdBy: U1,
  })
  await db
    .insert(exams)
    .values([mkExam(examPast, -DAY), mkExam(examFuture, DAY)])
  await db.insert(examQuestions).values(
    [examPast, examFuture].flatMap((examId) =>
      qIds.map((questionId, position) => ({ examId, questionId, position })),
    ),
  )

  await db.insert(examParticipations).values([
    {
      id: pPast,
      examId: examPast,
      userId: U1,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 2 * DAY),
    },
    {
      id: pFuture,
      examId: examFuture,
      userId: U2,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 1000),
    },
    {
      id: pDone,
      examId: examPast,
      userId: U3,
      status: "completed",
      score: 100,
      startedAt: new Date(now - 2 * DAY),
      completedAt: new Date(now - DAY - 1000),
    },
  ])
  // 4 questions, 2 bonnes réponses pour pPast → score attendu 50.
  await db.insert(examAnswers).values([
    {
      id: createId(),
      participationId: pPast,
      questionId: qIds[0],
      selectedAnswer: "A",
      isCorrect: true,
    },
    {
      id: createId(),
      participationId: pPast,
      questionId: qIds[1],
      selectedAnswer: "A",
      isCorrect: true,
    },
    {
      id: createId(),
      participationId: pPast,
      questionId: qIds[2],
      selectedAnswer: "B",
      isCorrect: false,
    },
  ])

  const mkSession = (
    id: string,
    userId: string,
    status: "in_progress" | "completed",
    expiresOffset: number,
  ) => ({
    id,
    userId,
    status,
    questionCount: 4,
    score: status === "completed" ? 100 : null,
    startedAt: new Date(now - 2 * DAY),
    completedAt: status === "completed" ? new Date(now - DAY) : null,
    expiresAt: new Date(now + expiresOffset),
  })
  await db
    .insert(trainingSessions)
    .values([
      mkSession(tsExpired, U1, "in_progress", -DAY),
      mkSession(tsFuture, U2, "in_progress", DAY),
      mkSession(tsDone, U3, "completed", -DAY),
    ])
  // 4 items, 2 corrects pour tsExpired → score attendu 50.
  await db.insert(trainingSessionItems).values(
    qIds.map((questionId, position) => ({
      id: createId(),
      sessionId: tsExpired,
      questionId,
      position,
      selectedAnswer: position < 3 ? "A" : null,
      isCorrect: position < 2 ? true : position < 3 ? false : null,
    })),
  )
})

afterAll(async () => {
  await db.delete(exams).where(eq(exams.createdBy, U1)) // cascade questions/participations/answers
  await db.delete(trainingSessions).where(inArray(trainingSessions.userId, USERS))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(inArray(user.id, USERS))
})

const statusOf = (id: string) =>
  db
    .select({
      status: examParticipations.status,
      score: examParticipations.score,
      completedAt: examParticipations.completedAt,
    })
    .from(examParticipations)
    .where(eq(examParticipations.id, id))
    .limit(1)
    .then((r) => r[0])

const sessionOf = (id: string) =>
  db
    .select({
      status: trainingSessions.status,
      score: trainingSessions.score,
      completedAt: trainingSessions.completedAt,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .limit(1)
    .then((r) => r[0])

describe("closeExpiredExamParticipations", () => {
  it("ferme la participation d'un examen terminé (score calculé), laisse les autres", async () => {
    const res = await closeExpiredExamParticipations()
    expect(res.closedCount).toBeGreaterThanOrEqual(1)

    const past = await statusOf(pPast)
    expect(past?.status).toBe("auto_submitted")
    expect(past?.score).toBe(50) // 2/4
    expect(past?.completedAt).not.toBeNull()

    expect((await statusOf(pFuture))?.status).toBe("in_progress")
    expect((await statusOf(pDone))?.status).toBe("completed")
  })

  it("idempotent : une participation déjà fermée n'est pas re-traitée", async () => {
    // pPast n'est plus `in_progress` → exclu du 2e passage, état inchangé.
    // (On n'assertit pas un closedCount global : la branche éphémère hérite de
    // `develop` et peut contenir d'autres participations expirées.)
    const before = await statusOf(pPast)
    await closeExpiredExamParticipations()
    const after = await statusOf(pPast)
    expect(after?.status).toBe("auto_submitted")
    expect(after?.score).toBe(50)
    expect(after?.completedAt?.getTime()).toBe(before?.completedAt?.getTime())
  })
})

describe("closeExpiredTrainingSessions", () => {
  it("ferme la session expirée (score calculé), laisse les autres", async () => {
    const res = await closeExpiredTrainingSessions()
    expect(res.closedCount).toBeGreaterThanOrEqual(1)

    const expired = await sessionOf(tsExpired)
    expect(expired?.status).toBe("abandoned")
    expect(expired?.score).toBe(50) // 2/4
    expect(expired?.completedAt).not.toBeNull()

    expect((await sessionOf(tsFuture))?.status).toBe("in_progress")
    expect((await sessionOf(tsDone))?.status).toBe("completed")
  })
})
