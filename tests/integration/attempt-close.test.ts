import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
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
import { closeAttempts } from "@/features/attempts/close"
import { createId } from "@/lib/ids"

// Le module possède la règle du score de clôture (`CONTEXT.md`) : compte des
// justes, dénominateur par type, garde « encore ouverte ». Elle est prouvée ici
// une fois ; les appelants (actions, crons, démarrage de session) ne portent
// que le mapping vers ce verbe.
//
// Fixtures datées en 1990 : la branche éphémère hérite de `develop`, et un
// `expiredBefore` en 1991 ne peut attraper qu'elles.
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-09-19T12:00:00.000Z")
const ENDED = new Date("1990-06-01T00:00:00.000Z")
const SWEEP = new Date("1991-01-01T00:00:00.000Z")
// Fenêtre propre aux cas « limit » : leur assertion « exactement `limit`
// closes » ne doit dépendre ni de l'ordre des cas ni d'une ligne héritée.
const ENDED_LIMIT = new Date("1980-06-01T00:00:00.000Z")
const SWEEP_LIMIT = new Date("1981-01-01T00:00:00.000Z")
const suffix = createId().slice(0, 8)

const OWNER = createId()
const seededUsers = [OWNER]
const seededQuestions: string[] = []
const seededExams: string[] = []

const newUser = async () => {
  const id = createId()
  await db.insert(user).values({
    id,
    name: `Close ${id.slice(0, 6)}`,
    email: `close-${id.slice(0, 6)}-${suffix}@test.invalid`,
  })
  seededUsers.push(id)
  return id
}

const newQuestions = async (n: number) => {
  const ids = Array.from({ length: n }, () => createId())
  await db.insert(questions).values(
    ids.map((id, i) => ({
      id,
      question: `Q ${i} ${suffix} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj ${suffix}`,
      domain: `CLOSE-${suffix}`,
    })),
  )
  seededQuestions.push(...ids)
  return ids
}

const newExam = async (questionIds: string[], endDate = ENDED) => {
  const id = createId()
  await db.insert(exams).values({
    id,
    title: `Exam ${suffix} ${id.slice(0, 4)}`,
    startDate: new Date(endDate.getTime() - 3 * DAY),
    endDate,
    completionTime: 3600,
    isActive: true,
    createdBy: OWNER,
  })
  await db.insert(examQuestions).values(
    questionIds.map((questionId, position) => ({
      examId: id,
      questionId,
      position,
    })),
  )
  seededExams.push(id)
  return id
}

/**
 * `answers` : une entrée par ligne `exam_answers` à créer — `true`/`false`
 * = réponse jugée, `null` = ligne pré-créée sans réponse, absente = pas de
 * ligne (participation legacy).
 */
const newParticipation = async (o: {
  examId: string
  questionIds: string[]
  answers: (boolean | null)[]
  status?: "in_progress" | "completed"
  pause?: { pauseStartedAt: Date | null; totalPauseDurationMs: number }
}) => {
  const id = createId()
  await db.insert(examParticipations).values({
    id,
    examId: o.examId,
    userId: await newUser(),
    status: o.status ?? "in_progress",
    score: o.status === "completed" ? 100 : 0,
    startedAt: new Date(ENDED.getTime() - DAY),
    completedAt: o.status === "completed" ? ENDED : null,
    pauseStartedAt: o.pause?.pauseStartedAt ?? null,
    totalPauseDurationMs: o.pause?.totalPauseDurationMs ?? null,
  })
  if (o.answers.length > 0) {
    await db.insert(examAnswers).values(
      o.answers.map((isCorrect, i) => ({
        id: createId(),
        participationId: id,
        questionId: o.questionIds[i]!,
        selectedAnswer: isCorrect === null ? null : isCorrect ? "A" : "B",
        isCorrect,
      })),
    )
  }
  return id
}

const newSession = async (o: {
  questionIds: string[]
  questionCount: number
  items: (boolean | null)[]
  status?: "in_progress" | "completed"
  expiresAt?: Date
  userId?: string
}) => {
  const id = createId()
  await db.insert(trainingSessions).values({
    id,
    userId: o.userId ?? (await newUser()),
    status: o.status ?? "in_progress",
    questionCount: o.questionCount,
    score: o.status === "completed" ? 100 : null,
    startedAt: new Date(ENDED.getTime() - DAY),
    completedAt: o.status === "completed" ? ENDED : null,
    expiresAt: o.expiresAt ?? ENDED,
  })
  if (o.items.length > 0) {
    await db.insert(trainingSessionItems).values(
      o.items.map((isCorrect, position) => ({
        id: createId(),
        sessionId: id,
        questionId: o.questionIds[position]!,
        position,
        selectedAnswer: isCorrect === null ? null : isCorrect ? "A" : "B",
        isCorrect,
      })),
    )
  }
  return id
}

const participation = (id: string) =>
  db
    .select({
      status: examParticipations.status,
      score: examParticipations.score,
      completedAt: examParticipations.completedAt,
      pauseStartedAt: examParticipations.pauseStartedAt,
      totalPauseDurationMs: examParticipations.totalPauseDurationMs,
    })
    .from(examParticipations)
    .where(eq(examParticipations.id, id))
    .limit(1)
    .then((r) => r[0]!)

const session = (id: string) =>
  db
    .select({
      status: trainingSessions.status,
      score: trainingSessions.score,
      completedAt: trainingSessions.completedAt,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .limit(1)
    .then((r) => r[0]!)

let qIds: string[]

beforeAll(async () => {
  await db.insert(user).values({
    id: OWNER,
    name: `Close owner ${suffix}`,
    email: `close-owner-${suffix}@test.invalid`,
  })
  qIds = await newQuestions(4)
})

afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, seededExams))
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.userId, seededUsers))
  await db.delete(questions).where(inArray(questions.id, seededQuestions))
  await db.delete(user).where(inArray(user.id, seededUsers))
})

describe("closeAttempts — participation (kind: exam)", () => {
  it("jumelles : { id } et { expiredBefore } écrivent le même score de clôture", async () => {
    const examId = await newExam(qIds)
    const answers = [true, true, false, null]
    const byId = await newParticipation({ examId, questionIds: qIds, answers })
    const bySweep = await newParticipation({
      examId,
      questionIds: qIds,
      answers,
    })

    await expect(
      closeAttempts(db, {
        kind: "exam",
        status: "completed",
        now: NOW,
        where: { id: byId },
      }),
    ).resolves.toEqual([byId])
    const swept = await closeAttempts(db, {
      kind: "exam",
      status: "auto_submitted",
      now: NOW,
      where: { expiredBefore: SWEEP, limit: 500 },
    })
    expect(swept).toContain(bySweep)
    expect(swept).not.toContain(byId)

    expect(await participation(byId)).toMatchObject({
      status: "completed",
      score: 50,
      completedAt: NOW,
    })
    expect(await participation(bySweep)).toMatchObject({
      status: "auto_submitted",
      score: 50,
      completedAt: NOW,
    })
  })

  it("sans lignes pré-créées : le dénominateur reste les questions de l'examen blanc", async () => {
    const examId = await newExam(qIds)
    // Deux réponses justes sur quatre questions : 50, pas 100.
    const byId = await newParticipation({
      examId,
      questionIds: qIds,
      answers: [true, true],
    })
    const bySweep = await newParticipation({
      examId,
      questionIds: qIds,
      answers: [true, true],
    })

    await closeAttempts(db, {
      kind: "exam",
      status: "completed",
      now: NOW,
      where: { id: byId },
    })
    await closeAttempts(db, {
      kind: "exam",
      status: "auto_submitted",
      now: NOW,
      where: { expiredBefore: SWEEP, limit: 500 },
    })

    expect((await participation(byId)).score).toBe(50)
    expect((await participation(bySweep)).score).toBe(50)
  })

  it("arrondi half-up : 23/40 → 58, parité avec computeScorePercent", async () => {
    const forty = await newQuestions(40)
    const examId = await newExam(forty)
    const id = await newParticipation({
      examId,
      questionIds: forty,
      answers: Array.from({ length: 23 }, () => true),
    })
    await closeAttempts(db, {
      kind: "exam",
      status: "completed",
      now: NOW,
      where: { id },
    })
    expect((await participation(id)).score).toBe(58)
  })

  it("garde : déjà close → intacte ; non expirée → hors du balayage", async () => {
    const ended = await newExam(qIds)
    const open = await newExam(qIds, new Date("2999-01-01T00:00:00.000Z"))
    const done = await newParticipation({
      examId: ended,
      questionIds: qIds,
      answers: [false, false, false, false],
      status: "completed",
    })
    const live = await newParticipation({
      examId: open,
      questionIds: qIds,
      answers: [true, true, true, true],
    })

    await expect(
      closeAttempts(db, {
        kind: "exam",
        status: "auto_submitted",
        now: NOW,
        where: { id: done },
      }),
    ).resolves.toEqual([])
    const swept = await closeAttempts(db, {
      kind: "exam",
      status: "auto_submitted",
      now: NOW,
      where: { expiredBefore: SWEEP, limit: 500 },
    })
    expect(swept).not.toContain(done)
    expect(swept).not.toContain(live)

    expect(await participation(done)).toMatchObject({
      status: "completed",
      score: 100,
      completedAt: ENDED,
    })
    expect(await participation(live)).toMatchObject({
      status: "in_progress",
      score: 0,
      completedAt: null,
    })
  })

  it("limit : un balayage borné ne clôt que `limit` participations", async () => {
    const examId = await newExam(qIds, ENDED_LIMIT)
    const ids = await Promise.all(
      Array.from({ length: 3 }, () =>
        newParticipation({ examId, questionIds: qIds, answers: [true] }),
      ),
    )
    const swept = await closeAttempts(db, {
      kind: "exam",
      status: "auto_submitted",
      now: NOW,
      where: { expiredBefore: SWEEP_LIMIT, limit: 2 },
    })
    expect(swept).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining(swept))
    const statuses = await Promise.all(ids.map(participation))
    expect(statuses.filter((p) => p.status === "in_progress")).toHaveLength(1)
  })

  it("set : le crédit de pause est écrit par { id }, jamais touché par le balayage", async () => {
    const examId = await newExam(qIds)
    const pause = { pauseStartedAt: ENDED, totalPauseDurationMs: 1_000 }
    const byId = await newParticipation({
      examId,
      questionIds: qIds,
      answers: [],
      pause,
    })
    const bySweep = await newParticipation({
      examId,
      questionIds: qIds,
      answers: [],
      pause,
    })

    await closeAttempts(db, {
      kind: "exam",
      status: "completed",
      now: NOW,
      where: { id: byId },
      set: { pauseStartedAt: null, totalPauseDurationMs: 12_345 },
    })
    await closeAttempts(db, {
      kind: "exam",
      status: "auto_submitted",
      now: NOW,
      where: { expiredBefore: SWEEP, limit: 500 },
    })

    expect(await participation(byId)).toMatchObject({
      status: "completed",
      score: 0,
      pauseStartedAt: null,
      totalPauseDurationMs: 12_345,
    })
    expect(await participation(bySweep)).toMatchObject({
      status: "auto_submitted",
      score: 0,
      pauseStartedAt: ENDED,
      totalPauseDurationMs: 1_000,
    })
  })
})

describe("closeAttempts — session d'entraînement (kind: training)", () => {
  it("jumelles : { id } et { expiredBefore } écrivent le même score de clôture", async () => {
    const items = [true, true, false, null]
    const byId = await newSession({
      questionIds: qIds,
      questionCount: 4,
      items,
    })
    const bySweep = await newSession({
      questionIds: qIds,
      questionCount: 4,
      items,
    })

    await expect(
      closeAttempts(db, {
        kind: "training",
        status: "completed",
        now: NOW,
        where: { id: byId },
      }),
    ).resolves.toEqual([byId])
    const swept = await closeAttempts(db, {
      kind: "training",
      status: "abandoned",
      now: NOW,
      where: { expiredBefore: SWEEP, limit: 100 },
    })
    expect(swept).toContain(bySweep)
    expect(swept).not.toContain(byId)

    expect(await session(byId)).toMatchObject({
      status: "completed",
      score: 50,
      completedAt: NOW,
    })
    expect(await session(bySweep)).toMatchObject({
      status: "abandoned",
      score: 50,
      completedAt: NOW,
    })
  })

  it("items partiels : le dénominateur est le nombre de questions tiré", async () => {
    // Deux items justes, quatre questions tirées : 50, pas 100.
    const id = await newSession({
      questionIds: qIds,
      questionCount: 4,
      items: [true, true],
    })
    await closeAttempts(db, {
      kind: "training",
      status: "completed",
      now: NOW,
      where: { id },
    })
    expect((await session(id)).score).toBe(50)
  })

  it("arrondi half-up : 23/40 → 58, parité avec computeScorePercent", async () => {
    const forty = await newQuestions(40)
    const id = await newSession({
      questionIds: forty,
      questionCount: 40,
      items: Array.from({ length: 23 }, () => true),
    })
    await closeAttempts(db, {
      kind: "training",
      status: "completed",
      now: NOW,
      where: { id },
    })
    expect((await session(id)).score).toBe(58)
  })

  it("aucun item : score 0, pas d'échec", async () => {
    const id = await newSession({
      questionIds: qIds,
      questionCount: 4,
      items: [],
    })
    await closeAttempts(db, {
      kind: "training",
      status: "abandoned",
      now: NOW,
      where: { expiredBefore: SWEEP, limit: 100 },
    })
    expect(await session(id)).toMatchObject({ status: "abandoned", score: 0 })
  })

  it("garde : déjà close → intacte ; non expirée → hors du balayage", async () => {
    const done = await newSession({
      questionIds: qIds,
      questionCount: 4,
      items: [false, false, false, false],
      status: "completed",
    })
    const live = await newSession({
      questionIds: qIds,
      questionCount: 4,
      items: [true, true, true, true],
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    })

    await expect(
      closeAttempts(db, {
        kind: "training",
        status: "abandoned",
        now: NOW,
        where: { id: done },
      }),
    ).resolves.toEqual([])
    const swept = await closeAttempts(db, {
      kind: "training",
      status: "abandoned",
      now: NOW,
      where: { expiredBefore: SWEEP, limit: 100 },
    })
    expect(swept).not.toContain(done)
    expect(swept).not.toContain(live)

    expect(await session(done)).toMatchObject({
      status: "completed",
      score: 100,
      completedAt: ENDED,
    })
    expect(await session(live)).toMatchObject({
      status: "in_progress",
      score: null,
      completedAt: null,
    })
  })

  it("limit : un balayage borné ne clôt que `limit` sessions", async () => {
    const ids = await Promise.all(
      Array.from({ length: 3 }, () =>
        newSession({
          questionIds: qIds,
          questionCount: 4,
          items: [true],
          expiresAt: ENDED_LIMIT,
        }),
      ),
    )
    const swept = await closeAttempts(db, {
      kind: "training",
      status: "abandoned",
      now: NOW,
      where: { expiredBefore: SWEEP_LIMIT, limit: 2 },
    })
    expect(swept).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining(swept))
    const statuses = await Promise.all(ids.map(session))
    expect(statuses.filter((s) => s.status === "in_progress")).toHaveLength(1)
  })

  it("{ expiredBefore, id } : ne clôt que cette session, même expirée parmi d'autres", async () => {
    const userId = await newUser()
    const target = await newSession({
      userId,
      questionIds: qIds,
      questionCount: 4,
      items: [true, false],
    })
    const other = await newSession({
      userId,
      questionIds: qIds,
      questionCount: 4,
      items: [true, false],
    })

    await expect(
      closeAttempts(db, {
        kind: "training",
        status: "abandoned",
        now: NOW,
        where: { expiredBefore: SWEEP, limit: 100, id: target },
      }),
    ).resolves.toEqual([target])

    expect(await session(target)).toMatchObject({
      status: "abandoned",
      score: 25,
    })
    expect((await session(other)).status).toBe("in_progress")
  })

  it("{ expiredBefore, id } : une session non expirée n'est pas close", async () => {
    const id = await newSession({
      questionIds: qIds,
      questionCount: 4,
      items: [true],
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    })
    await expect(
      closeAttempts(db, {
        kind: "training",
        status: "abandoned",
        now: NOW,
        where: { expiredBefore: SWEEP, limit: 100, id },
      }),
    ).resolves.toEqual([])
    expect((await session(id)).status).toBe("in_progress")
  })
})
