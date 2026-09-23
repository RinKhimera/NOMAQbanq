import { and, eq, inArray } from "drizzle-orm"
import { afterAll, describe, expect, it, vi } from "vitest"
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
import { getMyDomainMastery } from "@/features/analytics/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const suffix = createId().slice(0, 8)
const createdUsers: string[] = []
const createdQuestions: string[] = []
const createdSessions: string[] = []
const createdExams: string[] = []

const at = (iso: string) => new Date(`2026-01-01T${iso}:00Z`)

const newStudent = async () => {
  const id = createId()
  createdUsers.push(id)
  await db.insert(user).values({
    id,
    name: "Maîtrise",
    email: `mastery-${id}-${suffix}@test.invalid`,
  })
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id, role: "user" },
  } as never)
  return id
}

const newQuestion = async (
  domain: string,
  { deleted = false }: { deleted?: boolean } = {},
) => {
  const id = createId()
  createdQuestions.push(id)
  await db.insert(questions).values({
    id,
    question: `Q ${suffix}`,
    correctAnswer: "A",
    options: ["A", "B"],
    objectifCmc: "Objectif",
    domain,
    deletedAt: deleted ? new Date() : null,
  })
  return id
}

/** Une session d'entraînement ; `isCorrect: null` = question tirée, non répondue. */
const train = async (
  userId: string,
  items: { questionId: string; isCorrect: boolean | null; answeredAt: Date }[],
) => {
  const sessionId = createId()
  createdSessions.push(sessionId)
  await db.insert(trainingSessions).values({
    id: sessionId,
    userId,
    status: "completed",
    mode: "test",
    questionCount: items.length,
    startedAt: at("00:00"),
    expiresAt: at("23:00"),
  })
  await db.insert(trainingSessionItems).values(
    items.map((item, position) => ({
      sessionId,
      questionId: item.questionId,
      position,
      selectedAnswer: item.isCorrect === null ? null : "A",
      isCorrect: item.isCorrect,
      answeredAt: item.isCorrect === null ? null : item.answeredAt,
    })),
  )
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Un examen blanc et la participation de `userId`, close à `completedAt` (ou
 * encore en cours si `null`). `open` : l'examen n'est pas encore terminé.
 */
const sitExam = async (
  userId: string,
  answers: { questionId: string; isCorrect: boolean | null }[],
  { open, completedAt }: { open: boolean; completedAt: Date | null },
) => {
  const examId = createId()
  createdExams.push(examId)
  const now = Date.now()
  await db.insert(exams).values({
    id: examId,
    title: `Maîtrise ${suffix}`,
    startDate: new Date(now - 10 * DAY),
    endDate: open ? new Date(now + DAY) : new Date(now - DAY),
    completionTime: 3600,
    createdBy: userId,
  })
  await db.insert(examQuestions).values(
    answers.map((a, position) => ({
      examId,
      questionId: a.questionId,
      position,
    })),
  )
  const participationId = createId()
  await db.insert(examParticipations).values({
    id: participationId,
    examId,
    userId,
    status: completedAt ? "completed" : "in_progress",
    score: 0,
    startedAt: new Date(now - 2 * DAY),
    completedAt,
  })
  await db.insert(examAnswers).values(
    answers.map((a) => ({
      participationId,
      questionId: a.questionId,
      selectedAnswer: a.isCorrect === null ? null : "A",
      isCorrect: a.isCorrect,
    })),
  )
  return { examId, participationId }
}

const masteryOf = async (domain: string) =>
  (await getMyDomainMastery()).find((d) => d.domain === domain)

afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, createdExams))
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.id, createdSessions))
  await db.delete(questions).where(inArray(questions.id, createdQuestions))
  await db.delete(user).where(inArray(user.id, createdUsers))
})

describe("maîtrise par domaine", () => {
  it("rend la part de réponses justes du domaine, et rien pour un domaine jamais pratiqué", async () => {
    const student = await newStudent()
    const [q1, q2, q3] = [
      await newQuestion("Cardiologie"),
      await newQuestion("Cardiologie"),
      await newQuestion("Cardiologie"),
    ]
    await train(student, [
      { questionId: q1, isCorrect: true, answeredAt: at("10:00") },
      { questionId: q2, isCorrect: true, answeredAt: at("10:01") },
      { questionId: q3, isCorrect: false, answeredAt: at("10:02") },
    ])

    expect(await masteryOf("Cardiologie")).toEqual({
      domain: "Cardiologie",
      answered: 3,
      mastery: 67,
    })
    expect(await masteryOf("Neurologie")).toEqual({
      domain: "Neurologie",
      answered: 0,
      mastery: null,
    })
  })

  it("retient la dernière réponse à une question", async () => {
    const student = await newStudent()
    const q = await newQuestion("Pédiatrie")
    await train(student, [
      { questionId: q, isCorrect: false, answeredAt: at("10:00") },
    ])
    await train(student, [
      { questionId: q, isCorrect: true, answeredAt: at("11:00") },
    ])
    expect(await masteryOf("Pédiatrie")).toMatchObject({
      answered: 1,
      mastery: 100,
    })
  })

  it("jumeau : une réponse juste suivie d'une fausse compte fausse", async () => {
    const student = await newStudent()
    const q = await newQuestion("Pédiatrie")
    await train(student, [
      { questionId: q, isCorrect: true, answeredAt: at("10:00") },
    ])
    await train(student, [
      { questionId: q, isCorrect: false, answeredAt: at("11:00") },
    ])
    expect(await masteryOf("Pédiatrie")).toMatchObject({
      answered: 1,
      mastery: 0,
    })
  })

  it("date une réponse d'examen de la clôture de sa participation", async () => {
    const student = await newStudent()
    const q = await newQuestion("Neurologie")
    // Entraînement raté à 10 h, examen réussi clos à 12 h : l'examen est la
    // dernière réponse.
    await train(student, [
      { questionId: q, isCorrect: false, answeredAt: at("10:00") },
    ])
    await sitExam(student, [{ questionId: q, isCorrect: true }], {
      open: false,
      completedAt: at("12:00"),
    })
    expect(await masteryOf("Neurologie")).toMatchObject({ mastery: 100 })
  })

  it("jumeau : un entraînement postérieur à la clôture l'emporte sur l'examen", async () => {
    const student = await newStudent()
    const q = await newQuestion("Neurologie")
    await sitExam(student, [{ questionId: q, isCorrect: true }], {
      open: false,
      completedAt: at("09:00"),
    })
    await train(student, [
      { questionId: q, isCorrect: false, answeredAt: at("10:00") },
    ])
    expect(await masteryOf("Neurologie")).toMatchObject({ mastery: 0 })
  })

  it("ne compte ni les questions laissées sans réponse, ni les questions supprimées", async () => {
    const student = await newStudent()
    const answered = await newQuestion("Psychiatrie")
    const skippedInTraining = await newQuestion("Psychiatrie")
    const skippedInExam = await newQuestion("Psychiatrie")
    const deleted = await newQuestion("Psychiatrie", { deleted: true })
    await train(student, [
      { questionId: answered, isCorrect: true, answeredAt: at("10:00") },
      {
        questionId: skippedInTraining,
        isCorrect: null,
        answeredAt: at("10:01"),
      },
      { questionId: deleted, isCorrect: false, answeredAt: at("10:02") },
    ])
    await sitExam(student, [{ questionId: skippedInExam, isCorrect: null }], {
      open: false,
      completedAt: at("12:00"),
    })
    expect(await masteryOf("Psychiatrie")).toMatchObject({
      answered: 1,
      mastery: 100,
    })
  })

  it("ne bouge pas avec les réponses d'un examen ouvert, justes ou fausses, puis les intègre à la clôture", async () => {
    const student = await newStudent()
    const known = await newQuestion("Dermatologie")
    const inExam = await newQuestion("Dermatologie")
    await train(student, [
      { questionId: known, isCorrect: true, answeredAt: at("10:00") },
    ])
    const baseline = await masteryOf("Dermatologie")
    expect(baseline).toMatchObject({ answered: 1, mastery: 100 })

    const { examId, participationId } = await sitExam(
      student,
      [{ questionId: inExam, isCorrect: false }],
      { open: true, completedAt: at("11:00") },
    )
    expect(await masteryOf("Dermatologie")).toEqual(baseline)

    await db
      .update(examAnswers)
      .set({ isCorrect: true })
      .where(
        and(
          eq(examAnswers.participationId, participationId),
          eq(examAnswers.questionId, inExam),
        ),
      )
    expect(await masteryOf("Dermatologie")).toEqual(baseline)

    await db
      .update(exams)
      .set({ endDate: new Date(Date.now() - 1000) })
      .where(eq(exams.id, examId))
    expect(await masteryOf("Dermatologie")).toMatchObject({
      answered: 2,
      mastery: 100,
    })
  })

  it("écarte une question retenue tout entière, réponses d'entraînement antérieures comprises, jusqu'à la clôture", async () => {
    const student = await newStudent()
    const known = await newQuestion("Rhumatologie")
    const alsoInExam = await newQuestion("Rhumatologie")
    await train(student, [
      { questionId: known, isCorrect: true, answeredAt: at("10:00") },
      { questionId: alsoInExam, isCorrect: false, answeredAt: at("10:01") },
    ])
    expect(await masteryOf("Rhumatologie")).toMatchObject({
      answered: 2,
      mastery: 50,
    })

    const { examId } = await sitExam(
      student,
      [{ questionId: alsoInExam, isCorrect: null }],
      { open: true, completedAt: null },
    )
    expect(await masteryOf("Rhumatologie")).toMatchObject({
      answered: 1,
      mastery: 100,
    })

    await db
      .update(exams)
      .set({ endDate: new Date(Date.now() - 1000) })
      .where(eq(exams.id, examId))
    expect(await masteryOf("Rhumatologie")).toMatchObject({
      answered: 2,
      mastery: 50,
    })
  })

  it("ne rend rien sans session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null)
    expect(await getMyDomainMastery()).toEqual([])
  })
})
