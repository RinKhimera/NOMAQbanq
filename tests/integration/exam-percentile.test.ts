import { and, eq, inArray } from "drizzle-orm"
import { afterAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import {
  getExamPercentileForUser,
  getMyExamPercentiles,
} from "@/features/analytics/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const createdUsers: string[] = []
const createdExams: string[] = []
const createdQuestions: string[] = []

const asUser = (id: string, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)

type Participant = {
  score: number
  role?: "user" | "admin"
  deleted?: boolean
  status?: "completed" | "auto_submitted" | "in_progress"
}

/** Un examen et ses participants ; rend l'id de l'examen et ceux des participants, dans l'ordre. */
const seedExam = async (
  participants: Participant[],
  { open = false }: { open?: boolean } = {},
) => {
  const now = Date.now()
  const examId = createId()
  const userIds = participants.map(() => createId())
  createdUsers.push(...userIds)
  createdExams.push(examId)

  await db.insert(user).values(
    participants.map((p, i) => ({
      id: userIds[i],
      name: `Pct ${i}`,
      email: `pct-${i}-${examId}-${suffix}@test.invalid`,
      role: p.role ?? "user",
      deletedAt: p.deleted ? new Date(now - DAY) : null,
    })),
  )
  await db.insert(exams).values({
    id: examId,
    title: `Percentile ${suffix}`,
    startDate: new Date(now - 10 * DAY),
    endDate: open ? new Date(now + DAY) : new Date(now - DAY),
    completionTime: 3600,
    createdBy: userIds[0],
  })
  await db.insert(examParticipations).values(
    participants.map((p, i) => ({
      examId,
      userId: userIds[i],
      status: p.status ?? "completed",
      score: p.score,
      startedAt: new Date(now - 5 * DAY),
      completedAt: new Date(now - 5 * DAY + 1000),
    })),
  )
  return { examId, userIds }
}

/**
 * Rend retenu le score de la participation de `userId` à `examId` : il y a
 * répondu à une question qui figure aussi dans un examen OUVERT auquel il
 * participe (correction différée).
 */
const withholdScore = async (examId: string, userId: string) => {
  const now = Date.now()
  const questionId = createId()
  const openExamId = createId()
  createdQuestions.push(questionId)
  createdExams.push(openExamId)
  await db.insert(questions).values({
    id: questionId,
    question: `Q retenue ${suffix}`,
    correctAnswer: "A",
    options: ["A", "B"],
    objectifCmc: "Objectif",
    domain: "Cardiologie",
  })
  await db.insert(exams).values({
    id: openExamId,
    title: `Ouvert ${suffix}`,
    startDate: new Date(now - DAY),
    endDate: new Date(now + DAY),
    completionTime: 3600,
    createdBy: userId,
  })
  await db.insert(examQuestions).values({
    examId: openExamId,
    questionId,
    position: 0,
  })
  await db.insert(examParticipations).values({
    examId: openExamId,
    userId,
    status: "in_progress",
    startedAt: new Date(now),
  })
  const [participation] = await db
    .select({ id: examParticipations.id })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, userId),
      ),
    )
  await db.insert(examAnswers).values({
    participationId: participation!.id,
    questionId,
    selectedAnswer: "A",
    isCorrect: true,
  })
}

afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, createdExams))
  await db.delete(questions).where(inArray(questions.id, createdQuestions))
  await db.delete(user).where(inArray(user.id, createdUsers))
})

describe("percentile d'examen", () => {
  it("rend la part des autres participants au score strictement inférieur", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60 },
    ])
    asUser(userIds[0])
    // 70 bat 40, 50 et 60 : 3 des 4 autres.
    expect((await getMyExamPercentiles())[examId]).toBe(75)
  })

  it("n'existe pas sous 5 participations lisibles", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
    ])
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId]).toBeNull()
  })

  it("ne compte pas les ex æquo comme battus", async () => {
    const { examId, userIds } = await seedExam([
      { score: 60 },
      { score: 60 },
      { score: 40 },
      { score: 80 },
      { score: 20 },
    ])
    asUser(userIds[0])
    // 60 bat 40 et 20, pas l'autre 60 : 2 des 4 autres.
    expect((await getMyExamPercentiles())[examId]).toBe(50)
  })

  it("arrondit à l'entier inférieur, pour ne jamais surestimer la position", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 60 },
      { score: 65 },
      { score: 90 },
      { score: 95 },
    ])
    asUser(userIds[0])
    // 70 bat 4 des 6 autres : 66,67 %.
    expect((await getMyExamPercentiles())[examId]).toBe(66)
  })

  it("rend 100 au premier sans ex æquo", async () => {
    const { examId, userIds } = await seedExam([
      { score: 95 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60 },
    ])
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId]).toBe(100)
  })

  it("n'existe pas pour un examen ouvert", async () => {
    const { examId, userIds } = await seedExam(
      [
        { score: 70 },
        { score: 40 },
        { score: 50 },
        { score: 90 },
        { score: 60 },
      ],
      { open: true },
    )
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId] ?? null).toBeNull()
  })

  it("écarte les comptes admin et supprimés du groupe de pairs", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 10, role: "admin" },
      { score: 20, deleted: true },
    ])
    asUser(userIds[0])
    // 4 étudiants lisibles seulement : sous le seuil.
    expect((await getMyExamPercentiles())[examId]).toBeNull()
  })

  it("compte les participations soumises à l'expiration du temps", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60, status: "auto_submitted" },
    ])
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId]).toBe(75)
  })

  it("ignore une participation encore en cours", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60, status: "in_progress" },
    ])
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId]).toBeNull()
  })

  it("écarte un pair au score retenu", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60 },
    ])
    await withholdScore(examId, userIds[4]!)
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId]).toBeNull()
  })

  it("n'existe pas quand le score du participant est retenu", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60 },
      { score: 30 },
    ])
    await withholdScore(examId, userIds[0]!)
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId]).toBeNull()
  })
})

describe("percentile d'examen côté admin", () => {
  it("lit le percentile d'un étudiant", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60 },
    ])
    asUser(createId(), "admin")
    expect(await getExamPercentileForUser(examId, userIds[3]!)).toBe(100)
  })

  it("est refusé à un étudiant", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 40 },
      { score: 50 },
      { score: 90 },
      { score: 60 },
    ])
    asUser(userIds[0])
    await expect(
      getExamPercentileForUser(examId, userIds[1]!),
    ).rejects.toThrow()
  })
})
