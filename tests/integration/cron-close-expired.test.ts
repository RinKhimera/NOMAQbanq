import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
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
import { closeExpiredExamParticipations } from "@/features/exams/cron"
import { closeExpiredTrainingSessions } from "@/features/training/cron"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

const DAY = 24 * 60 * 60 * 1000

// Les deux crons ne portent que la sélection des expirées et le statut de
// clôture ; le score de clôture appartient à `closeAttempts`, prouvé dans
// attempt-close.test.ts.
const U1 = createId() // in_progress expiré → fermé
const U2 = createId() // in_progress non expiré → intact
const U3 = createId() // déjà terminé → intact
const USERS = [U1, U2, U3]
const qIds = Array.from({ length: 4 }, () => createId())

beforeAll(async () => {
  await db.insert(user).values(
    USERS.map((id, i) => ({
      id,
      name: `Cron ${i}`,
      email: `cron-${i}@test.invalid`,
    })),
  )
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q ${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "CRON",
    })),
  )
})

/**
 * Un examen clos et un examen ouvert ; U1 en cours sur le clos (2 justes sur
 * 4), U2 en cours sur l'ouvert, U3 déjà terminé sur le clos.
 */
const seedParticipations = async () => {
  const now = Date.now()
  const examPast = createId()
  const examFuture = createId()
  const ids = { pPast: createId(), pFuture: createId(), pDone: createId() }
  const mkExam = (id: string, endOffset: number) => ({
    id,
    title: `Exam ${id.slice(0, 4)}`,
    startDate: new Date(now - 3 * DAY),
    endDate: new Date(now + endOffset),
    completionTime: 3600,
    isActive: true,
    createdBy: U1,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  await db
    .insert(exams)
    .values([mkExam(examPast, -DAY), mkExam(examFuture, DAY)])
  await db
    .insert(examQuestions)
    .values(
      [examPast, examFuture].flatMap((examId) =>
        qIds.map((questionId, position) => ({ examId, questionId, position })),
      ),
    )
  await db.insert(examParticipations).values([
    {
      id: ids.pPast,
      examId: examPast,
      userId: U1,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 2 * DAY),
    },
    {
      id: ids.pFuture,
      examId: examFuture,
      userId: U2,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 1000),
    },
    {
      id: ids.pDone,
      examId: examPast,
      userId: U3,
      status: "completed",
      score: 100,
      startedAt: new Date(now - 2 * DAY),
      completedAt: new Date(now - DAY - 1000),
    },
  ])
  await db.insert(examAnswers).values(
    [true, true, false].map((isCorrect, i) => ({
      participationId: ids.pPast,
      questionId: qIds[i],
      selectedAnswer: isCorrect ? "A" : "B",
      isCorrect,
    })),
  )
  return ids
}

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
  it("ferme en auto_submitted la participation d'un examen terminé, laisse les autres", async () => {
    const { pPast, pFuture, pDone } = await seedParticipations()

    const res = await closeExpiredExamParticipations()
    expect(res.closedCount).toBe(1)

    const past = await statusOf(pPast)
    expect(past?.status).toBe("auto_submitted")
    expect(past?.score).toBe(50) // 2/4
    expect(past?.completedAt).not.toBeNull()

    expect((await statusOf(pFuture))?.status).toBe("in_progress")
    expect((await statusOf(pDone))?.status).toBe("completed")
  })

  it("idempotent : une participation déjà fermée n'est pas re-traitée", async () => {
    const { pPast } = await seedParticipations()
    expect((await closeExpiredExamParticipations()).closedCount).toBe(1)
    const before = await statusOf(pPast)

    expect((await closeExpiredExamParticipations()).closedCount).toBe(0)
    const after = await statusOf(pPast)
    expect(after?.status).toBe("auto_submitted")
    expect(after?.score).toBe(50)
    expect(after?.completedAt?.getTime()).toBe(before?.completedAt?.getTime())
  })
})

describe("closeExpiredTrainingSessions", () => {
  it("ferme en abandoned la session expirée, laisse les autres", async () => {
    const now = Date.now()
    const tsExpired = createId()
    const tsFuture = createId()
    const tsDone = createId()
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
    await db.insert(trainingSessionItems).values(
      qIds.map((questionId, position) => ({
        sessionId: tsExpired,
        questionId,
        position,
        selectedAnswer: position < 3 ? "A" : null,
        isCorrect: position < 2 ? true : position < 3 ? false : null,
      })),
    )

    const res = await closeExpiredTrainingSessions()
    expect(res.closedCount).toBe(1)

    const expired = await sessionOf(tsExpired)
    expect(expired?.status).toBe("abandoned")
    expect(expired?.score).toBe(50) // 2/4
    expect(expired?.completedAt).not.toBeNull()

    expect((await sessionOf(tsFuture))?.status).toBe("in_progress")
    expect((await sessionOf(tsDone))?.status).toBe("completed")
  })
})
